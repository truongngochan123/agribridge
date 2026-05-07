package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerMarketPriceDtos;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.MarketPriceSnapshotEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.MarketPriceSnapshotRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.BuyerMarketPriceService;
import com.agribridge.backend.service.CurrentUserService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerMarketPriceServiceImpl implements BuyerMarketPriceService {

    private static final List<String> INTERNAL_SOURCES = List.of(
            MarketPriceAggregationServiceImpl.SOURCE_LISTING,
            MarketPriceAggregationServiceImpl.SOURCE_TRANSACTION);

    private final CurrentUserService currentUserService;
    private final MarketPriceSnapshotRepository marketPriceRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final CompanyRepository companyRepository;
    private final MarketPriceAggregationServiceImpl marketPriceAggregationService;
    private final BatchAvailabilityService batchAvailabilityService;

    @Override
    @Transactional
    public List<BuyerMarketPriceDtos.Row> getMarketPrices(String keyword, Long categoryId, String productType, String region, String grade, String size, String sourceType, String range) {
        currentUserService.requireCurrentBuyerCompanyId();
        LocalDate start = rangeStart(range);
        String source = normalizeSource(sourceType);
        List<MarketPriceSnapshotEntity> rows = loadRowsWithRebuild(start).stream()
                .filter(item -> source == null || source.equals(item.getSourceType()))
                .filter(item -> categoryId == null || Objects.equals(categoryId, item.getCategoryId()))
                .filter(item -> matches(item.getRegion(), region))
                .filter(item -> matches(item.getGrade(), grade))
                .filter(item -> matches(item.getSize(), size))
                .filter(item -> matchesProduct(item, productType))
                .filter(item -> matchesKeyword(item, keyword))
                .toList();
        Map<Long, CategoryEntity> categories = categoryMap(rows.stream().map(MarketPriceSnapshotEntity::getCategoryId).toList());
        return latestByGroup(rows).stream()
                .map(item -> toRow(item, previousFor(item, rows), categories.get(item.getCategoryId())))
                .sorted(Comparator.comparing(BuyerMarketPriceDtos.Row::updatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Override
    @Transactional
    public BuyerMarketPriceDtos.Filters getFilters() {
        currentUserService.requireCurrentBuyerCompanyId();
        List<MarketPriceSnapshotEntity> rows = loadRowsWithRebuild(null);
        Map<Long, CategoryEntity> categories = categoryMap(rows.stream().map(MarketPriceSnapshotEntity::getCategoryId).toList());
        List<BuyerMarketPriceDtos.Option> categoryOptions = categories.values().stream()
                .sorted(Comparator.comparing(CategoryEntity::getName))
                .map(item -> new BuyerMarketPriceDtos.Option(String.valueOf(item.getId()), item.getName()))
                .toList();
        List<BuyerMarketPriceDtos.Option> productTypes = rows.stream()
                .filter(item -> clean(item.getNormalizedProductName()) != null)
                .collect(Collectors.toMap(
                        MarketPriceSnapshotEntity::getNormalizedProductName,
                        item -> new BuyerMarketPriceDtos.Option(item.getNormalizedProductName(), firstText(item.getProductTypeName(), item.getNormalizedProductName())),
                        (left, right) -> left,
                        LinkedHashMap::new))
                .values().stream().toList();
        List<BuyerMarketPriceDtos.Option> sourceTypes = rows.stream()
                .map(MarketPriceSnapshotEntity::getSourceType)
                .map(this::clean)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .map(item -> new BuyerMarketPriceDtos.Option(item, sourceLabel(item)))
                .collect(Collectors.toCollection(ArrayList::new));
        sourceTypes.add(0, new BuyerMarketPriceDtos.Option("all", "Tat ca nguon"));
        return new BuyerMarketPriceDtos.Filters(
                categoryOptions,
                productTypes,
                distinct(rows.stream().map(MarketPriceSnapshotEntity::getRegion).toList()),
                distinct(rows.stream().map(MarketPriceSnapshotEntity::getGrade).toList()),
                distinct(rows.stream().map(MarketPriceSnapshotEntity::getSize).toList()),
                sourceTypes,
                List.of(
                        new BuyerMarketPriceDtos.Option("7d", "7 ngay qua"),
                        new BuyerMarketPriceDtos.Option("30d", "30 ngay qua"),
                        new BuyerMarketPriceDtos.Option("90d", "90 ngay qua"),
                        new BuyerMarketPriceDtos.Option("all", "Tat ca")));
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerMarketPriceDtos.HistoryResponse getHistory(String productTypeKey, String region, String grade, String size, String unit, String sourceType, String range) {
        currentUserService.requireCurrentBuyerCompanyId();
        String key = requireKey(productTypeKey);
        String source = normalizeSource(sourceType);
        LocalDate start = rangeStart(range);
        List<MarketPriceSnapshotEntity> rows = loadRows(start).stream()
                .filter(item -> key.equals(item.getNormalizedProductName()))
                .filter(item -> source == null || source.equals(item.getSourceType()))
                .filter(item -> matches(item.getRegion(), region))
                .filter(item -> matches(item.getGrade(), grade))
                .filter(item -> matches(item.getSize(), size))
                .filter(item -> matches(item.getUnit(), unit))
                .sorted(Comparator.comparing(MarketPriceSnapshotEntity::getPriceDate))
                .toList();
        MarketPriceSnapshotEntity latest = rows.isEmpty() ? null : rows.get(rows.size() - 1);
        MarketPriceSnapshotEntity previous = latest == null ? null : previousFor(latest, rows);
        BuyerMarketPriceDtos.Summary summary = latest == null
                ? new BuyerMarketPriceDtos.Summary(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0)
                : new BuyerMarketPriceDtos.Summary(latest.getMinPrice(), latest.getAvgPrice(), latest.getMinPrice(), latest.getMaxPrice(), change(latest, previous), latest.getSampleCount(), latest.getSupplierCount());
        return new BuyerMarketPriceDtos.HistoryResponse(summary, rows.stream()
                .map(item -> new BuyerMarketPriceDtos.Point(item.getPriceDate(), item.getAvgPrice(), item.getMinPrice(), item.getMaxPrice(), item.getSampleCount()))
                .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BuyerMarketPriceDtos.SupplierListing> getSuppliers(String productTypeKey, String region, String grade, String size, String unit) {
        currentUserService.requireCurrentBuyerCompanyId();
        String key = requireKey(productTypeKey);
        List<ProductEntity> products = productRepository.findAll().stream()
                .filter(product -> key.equals(normalize(product.getName())))
                .toList();
        Map<Long, ProductEntity> productById = products.stream().collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, CompanyEntity> suppliers = companyRepository.findAllById(products.stream().map(ProductEntity::getSupplierCompanyId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
        return batchRepository.findByProductIdInOrderByCreatedAtDesc(products.stream().map(ProductEntity::getId).toList()).stream()
                .filter(batch -> batch.getPrice() != null)
                .filter(batch -> {
                    ProductEntity product = productById.get(batch.getProductId());
                    CompanyEntity supplier = product == null ? null : suppliers.get(product.getSupplierCompanyId());
                    return batchAvailabilityService.isBuyerVisible(batch, supplier);
                })
                .filter(batch -> matches(batch.getGrade(), grade))
                .filter(batch -> matches(batch.getSize(), size))
                .filter(batch -> {
                    ProductEntity product = productById.get(batch.getProductId());
                    CompanyEntity supplier = product == null ? null : suppliers.get(product.getSupplierCompanyId());
                    return matches(listingRegion(product, supplier), region);
                })
                .map(batch -> {
                    ProductEntity product = productById.get(batch.getProductId());
                    CompanyEntity supplier = product == null ? null : suppliers.get(product.getSupplierCompanyId());
                    return new BuyerMarketPriceDtos.SupplierListing(
                            supplier == null ? "N/A" : supplier.getName(),
                            product == null ? null : product.getId(),
                            batch.getId(),
                            batch.getPrice(),
                            batch.getQuantity(),
                            batch.getGrade(),
                            batch.getSize(),
                            product == null ? unit : product.getUnit(),
                            listingRegion(product, supplier),
                            batch.getCreatedAt());
                })
                .toList();
    }

    private List<MarketPriceSnapshotEntity> loadRowsWithRebuild(LocalDate start) {
        List<MarketPriceSnapshotEntity> rows = loadRows(start);
        if (!rows.isEmpty()) return rows;
        marketPriceAggregationService.updateFromSupplierListings();
        return loadRows(start);
    }

    private List<MarketPriceSnapshotEntity> loadRows(LocalDate start) {
        return start == null
                ? marketPriceRepository.findBySourceTypeIn(INTERNAL_SOURCES)
                : marketPriceRepository.findBySourceTypeInAndPriceDateGreaterThanEqual(INTERNAL_SOURCES, start);
    }

    private List<MarketPriceSnapshotEntity> latestByGroup(List<MarketPriceSnapshotEntity> rows) {
        return rows.stream().collect(Collectors.toMap(
                this::groupKey,
                Function.identity(),
                (left, right) -> left.getPriceDate().isAfter(right.getPriceDate()) ? left : right,
                LinkedHashMap::new)).values().stream().toList();
    }

    private String groupKey(MarketPriceSnapshotEntity item) {
        return String.join("|",
                nullToEmpty(item.getNormalizedProductName()),
                nullToEmpty(item.getRegion()),
                nullToEmpty(item.getGrade()),
                nullToEmpty(item.getSize()),
                nullToEmpty(item.getUnit()),
                nullToEmpty(item.getSourceType()));
    }

    private MarketPriceSnapshotEntity previousFor(MarketPriceSnapshotEntity current, List<MarketPriceSnapshotEntity> rows) {
        return rows.stream()
                .filter(item -> groupKey(item).equals(groupKey(current)))
                .filter(item -> item.getPriceDate().isBefore(current.getPriceDate()))
                .max(Comparator.comparing(MarketPriceSnapshotEntity::getPriceDate))
                .orElse(null);
    }

    private BuyerMarketPriceDtos.Row toRow(MarketPriceSnapshotEntity item, MarketPriceSnapshotEntity previous, CategoryEntity category) {
        BigDecimal change = change(item, previous);
        return new BuyerMarketPriceDtos.Row(
                item.getId(),
                item.getProductTypeId(),
                firstText(item.getProductTypeName(), item.getNormalizedProductName()),
                item.getNormalizedProductName(),
                item.getCategoryId(),
                category == null ? null : category.getName(),
                item.getGrade(),
                item.getSize(),
                gradeSize(item.getGrade(), item.getSize()),
                item.getUnit(),
                item.getRegion(),
                item.getMinPrice(),
                item.getAvgPrice(),
                item.getMinPrice(),
                item.getMaxPrice(),
                change,
                changeType(change),
                item.getSourceType(),
                item.getSourceName(),
                item.getSampleCount(),
                item.getSupplierCount(),
                item.getPriceDate(),
                item.getUpdatedAt(),
                Boolean.TRUE.equals(item.getIsAbnormal()));
    }

    private BigDecimal change(MarketPriceSnapshotEntity current, MarketPriceSnapshotEntity previous) {
        if (current == null || previous == null || previous.getAvgPrice() == null || previous.getAvgPrice().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return current.getAvgPrice().subtract(previous.getAvgPrice())
                .divide(previous.getAvgPrice().abs(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private String changeType(BigDecimal change) {
        if (change == null || change.compareTo(BigDecimal.ZERO) == 0) return "FLAT";
        return change.compareTo(BigDecimal.ZERO) > 0 ? "UP" : "DOWN";
    }

    private LocalDate rangeStart(String range) {
        String normalized = range == null ? "30d" : range.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "7d" -> LocalDate.now().minusDays(6);
            case "30d" -> LocalDate.now().minusDays(29);
            case "90d" -> LocalDate.now().minusDays(89);
            case "all" -> null;
            default -> throw new IllegalArgumentException("range is invalid");
        };
    }

    private String normalizeSource(String sourceType) {
        String value = clean(sourceType);
        if (value == null || "all".equalsIgnoreCase(value)) return null;
        if (!INTERNAL_SOURCES.contains(value)) throw new IllegalArgumentException("sourceType is invalid");
        return value;
    }

    private String requireKey(String key) {
        String cleaned = clean(key);
        if (cleaned == null) throw new IllegalArgumentException("productTypeKey is required");
        return cleaned;
    }

    private Map<Long, CategoryEntity> categoryMap(Collection<Long> ids) {
        List<Long> cleanIds = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (cleanIds.isEmpty()) return Map.of();
        return categoryRepository.findAllById(cleanIds).stream().collect(Collectors.toMap(CategoryEntity::getId, Function.identity()));
    }

    private List<String> distinct(Collection<String> values) {
        return values.stream().map(this::clean).filter(Objects::nonNull).distinct().sorted().toList();
    }

    private boolean matches(String value, String filter) {
        String cleaned = clean(filter);
        return cleaned == null || cleaned.equalsIgnoreCase(clean(value));
    }

    private boolean matchesProduct(MarketPriceSnapshotEntity item, String productType) {
        String cleaned = clean(productType);
        return cleaned == null || cleaned.equals(item.getNormalizedProductName());
    }

    private boolean matchesKeyword(MarketPriceSnapshotEntity item, String keyword) {
        String cleaned = clean(keyword);
        if (cleaned == null) return true;
        String haystack = String.join(" ", nullToEmpty(item.getProductTypeName()), nullToEmpty(item.getNormalizedProductName()), nullToEmpty(item.getRegion()), nullToEmpty(item.getGrade()), nullToEmpty(item.getSize())).toLowerCase(Locale.ROOT);
        return haystack.contains(cleaned.toLowerCase(Locale.ROOT));
    }

    private String gradeSize(String grade, String size) {
        String result = List.of(nullToEmpty(grade), nullToEmpty(size)).stream().filter(item -> !item.isBlank()).collect(Collectors.joining(" / "));
        return result.isBlank() ? "N/A" : result;
    }

    private String normalize(String name) {
        String trimmed = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        String normalized = java.text.Normalizer.normalize(trimmed, java.text.Normalizer.Form.NFD);
        return java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+").matcher(normalized).replaceAll("").replaceAll("[^a-z0-9]+", " ").trim();
    }

    private String firstText(String first, String fallback) {
        String cleaned = clean(first);
        return cleaned == null ? clean(fallback) : cleaned;
    }

    private String listingRegion(ProductEntity product, CompanyEntity supplier) {
        return firstText(
                product == null ? null : product.getOriginProvince(),
                firstText(
                        supplier == null ? null : supplier.getProvince(),
                        firstText(supplier == null ? null : supplier.getAddress(), "Khong xac dinh")));
    }

    private String sourceLabel(String sourceType) {
        if (MarketPriceAggregationServiceImpl.SOURCE_LISTING.equals(sourceType)) return "Gia chao ban";
        if (MarketPriceAggregationServiceImpl.SOURCE_TRANSACTION.equals(sourceType)) return "Giao dich hoan tat";
        return sourceType;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
