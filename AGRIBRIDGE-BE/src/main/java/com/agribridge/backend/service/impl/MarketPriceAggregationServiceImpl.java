package com.agribridge.backend.service.impl;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.MarketPriceSnapshotRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.MarketPriceAggregationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.agribridge.backend.entity.MarketPriceSnapshotEntity;

@Service
@RequiredArgsConstructor
public class MarketPriceAggregationServiceImpl implements MarketPriceAggregationService {

    public static final String SOURCE_LISTING = "INTERNAL_SUPPLIER_LISTING";
    public static final String SOURCE_TRANSACTION = "INTERNAL_TRANSACTION";
    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private final MarketPriceSnapshotRepository marketPriceRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CompanyRepository companyRepository;
    private final BatchAvailabilityService batchAvailabilityService;

    @Override
    @Transactional
    public void rebuildInternalMarketPrices() {
        marketPriceRepository.deleteBySourceTypeIn(List.of(SOURCE_LISTING, SOURCE_TRANSACTION));
        updateFromSupplierListings();
        orderRepository.findAll().stream()
                .filter(order -> OrderStatusEnum.DELIVERED.equals(order.getStatus()))
                .map(OrderEntity::getId)
                .forEach(this::updateFromOrder);
    }

    @Override
    @Transactional
    public void updateFromSupplierListings() {
        List<ProductEntity> products = productRepository.findAll();
        Map<Long, ProductEntity> productById = products.stream().collect(HashMap::new, (map, product) -> map.put(product.getId(), product), HashMap::putAll);
        Map<Long, CompanyEntity> supplierById = companyRepository.findAllById(products.stream().map(ProductEntity::getSupplierCompanyId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(HashMap::new, (map, company) -> map.put(company.getId(), company), HashMap::putAll);
        List<BatchEntity> batches = products.isEmpty()
                ? List.of()
                : batchRepository.findByProductIdInOrderByCreatedAtDesc(products.stream().map(ProductEntity::getId).toList());
        Map<Key, Bucket> buckets = new HashMap<>();
        for (BatchEntity batch : batches) {
            ProductEntity product = productById.get(batch.getProductId());
            if (product == null || batch.getPrice() == null) continue;
            if (!batchAvailabilityService.isBuyerVisible(batch, supplierById.get(product.getSupplierCompanyId()))) continue;
            Key key = key(product, batch.getGrade(), batch.getSize(), firstText(product.getUnit(), "kg"), firstText(product.getOriginProvince(), "Không xác định"), LocalDate.now(), SOURCE_LISTING);
            buckets.computeIfAbsent(key, Bucket::new).add(batch.getPrice(), BigDecimal.ONE, product.getSupplierCompanyId());
        }
        buckets.values().forEach(this::upsert);
    }

    @Override
    @Transactional
    public void updateFromOrder(Long orderId) {
        if (orderId == null) return;
        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null || !OrderStatusEnum.DELIVERED.equals(order.getStatus())) return;
        List<OrderItemEntity> items = orderItemRepository.findByOrderIdOrderByIdAsc(orderId);
        Map<Long, ProductEntity> products = productRepository.findAllById(items.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(HashMap::new, (map, product) -> map.put(product.getId(), product), HashMap::putAll);
        Map<Long, BatchEntity> batches = batchRepository.findAllById(items.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(HashMap::new, (map, batch) -> map.put(batch.getId(), batch), HashMap::putAll);
        Map<Key, Bucket> buckets = new HashMap<>();
        for (OrderItemEntity item : items) {
            ProductEntity product = products.get(item.getProductId());
            BatchEntity batch = batches.get(item.getBatchId());
            if (product == null && batch != null) product = products.get(batch.getProductId());
            if (product == null || item.getPrice() == null) continue;
            BigDecimal qty = item.getQuantity() == null || item.getQuantity().compareTo(BigDecimal.ZERO) <= 0 ? BigDecimal.ONE : item.getQuantity();
            Key key = key(product, batch == null ? null : batch.getGrade(), batch == null ? null : batch.getSize(), firstText(item.getUnit(), product.getUnit()), firstText(order.getDeliveryProvince(), firstText(product.getOriginProvince(), "Không xác định")), order.getCreatedAt().toLocalDate(), SOURCE_TRANSACTION);
            buckets.computeIfAbsent(key, Bucket::new).add(item.getPrice(), qty, order.getSupplierCompanyId());
        }
        buckets.values().forEach(this::upsert);
    }

    @Override
    public String normalizeProductTypeName(String name) {
        String trimmed = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFD);
        return DIACRITICS.matcher(normalized).replaceAll("").replaceAll("[^a-z0-9]+", " ").trim();
    }

    private Key key(ProductEntity product, String grade, String size, String unit, String region, LocalDate date, String sourceType) {
        String normalizedName = normalizeProductTypeName(product.getName());
        CompanyEntity supplier = product.getSupplierCompanyId() == null ? null : companyRepository.findById(product.getSupplierCompanyId()).orElse(null);
        String resolvedRegion = SOURCE_LISTING.equals(sourceType)
                ? listingRegion(product, supplier)
                : firstText(region, listingRegion(product, supplier));
        return new Key(product.getId(), normalizedName, product.getName(), product.getCategoryId(), clean(resolvedRegion), clean(grade), clean(size), clean(unit), date, sourceType);
    }

    private void upsert(Bucket bucket) {
        Key key = bucket.key();
        MarketPriceSnapshotEntity entity = marketPriceRepository
                .findByNormalizedProductNameAndCategoryIdAndRegionAndGradeAndSizeAndUnitAndPriceDateAndSourceType(
                        key.normalizedName(), key.categoryId(), key.region(), key.grade(), key.size(), key.unit(), key.date(), key.sourceType())
                .orElseGet(() -> MarketPriceSnapshotEntity.builder()
                        .productId(key.productId())
                        .normalizedProductName(key.normalizedName())
                        .productTypeName(key.productTypeName())
                        .categoryId(key.categoryId())
                        .region(key.region())
                        .grade(key.grade())
                        .size(key.size())
                        .unit(key.unit())
                        .priceDate(key.date())
                        .sourceType(key.sourceType())
                        .sourceName(sourceName(key.sourceType()))
                        .isAbnormal(false)
                        .createdAt(LocalDateTime.now())
                        .build());
        entity.setMinPrice(bucket.min());
        entity.setMaxPrice(bucket.max());
        entity.setAvgPrice(bucket.avg());
        entity.setSampleCount(bucket.sampleCount());
        entity.setSupplierCount(bucket.supplierCount());
        entity.setUpdatedAt(LocalDateTime.now());
        marketPriceRepository.save(entity);
    }

    private String sourceName(String sourceType) {
        return SOURCE_TRANSACTION.equals(sourceType) ? "Giao dịch hoàn tất trên AgriBridge" : "Giá chào bán trên AgriBridge";
    }

    private String listingRegion(ProductEntity product, CompanyEntity supplier) {
        return firstText(
                product == null ? null : product.getOriginProvince(),
                firstText(
                        supplier == null ? null : supplier.getProvince(),
                        firstText(supplier == null ? null : supplier.getAddress(), "Không xác định")));
    }

    private String firstText(String first, String fallback) {
        String clean = clean(first);
        return clean == null ? clean(fallback) : clean;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Key(Long productId, String normalizedName, String productTypeName, Long categoryId, String region, String grade, String size, String unit, LocalDate date, String sourceType) {
    }

    private static final class Bucket {
        private final Key key;
        private final List<BigDecimal> prices = new ArrayList<>();
        private final List<BigDecimal> quantities = new ArrayList<>();
        private final List<Long> suppliers = new ArrayList<>();

        private Bucket(Key key) {
            this.key = key;
        }

        private Key key() { return key; }

        private void add(BigDecimal price, BigDecimal quantity, Long supplierId) {
            prices.add(price);
            quantities.add(quantity == null ? BigDecimal.ONE : quantity);
            if (supplierId != null) suppliers.add(supplierId);
        }

        private BigDecimal min() { return prices.stream().min(BigDecimal::compareTo).orElse(BigDecimal.ZERO); }
        private BigDecimal max() { return prices.stream().max(BigDecimal::compareTo).orElse(BigDecimal.ZERO); }
        private int sampleCount() { return prices.size(); }
        private int supplierCount() { return (int) suppliers.stream().distinct().count(); }
        private BigDecimal avg() {
            BigDecimal total = BigDecimal.ZERO;
            BigDecimal qty = BigDecimal.ZERO;
            for (int i = 0; i < prices.size(); i++) {
                total = total.add(prices.get(i).multiply(quantities.get(i)));
                qty = qty.add(quantities.get(i));
            }
            return qty.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO : total.divide(qty, 2, RoundingMode.HALF_UP);
        }
    }
}
