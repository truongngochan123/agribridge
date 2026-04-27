package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerSourcingProductDto;
import com.agribridge.backend.dto.CreateBuyerRfqDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BatchImageEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductCertificationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ProductImageEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.repository.BatchImageRepository;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.ProductCertificationRepository;
import com.agribridge.backend.repository.ProductImageRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.BuyerSourcingService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerSourcingServiceImpl implements BuyerSourcingService {

    private static final String PLACEHOLDER_IMAGE = "/images/seafood-market.jpg";

    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final BatchImageRepository batchImageRepository;
    private final ProductImageRepository productImageRepository;
    private final ProductCertificationRepository productCertificationRepository;
    private final CompanyRepository companyRepository;
    private final CategoryRepository categoryRepository;
    private final RfqRepository rfqRepository;

    @Override
    @Transactional(readOnly = true)
    public List<BuyerSourcingProductDto> getProducts() {
        List<ProductEntity> products = productRepository.findAll();
        return buildProductDtos(products);
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerSourcingProductDto getProduct(Long productId) {
        ProductEntity product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        return buildProductDtos(List.of(product)).get(0);
    }

    @Override
    @Transactional
    public Long createRfq(CreateBuyerRfqDto request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        RfqEntity rfq = RfqEntity.builder()
                .buyerCompanyId(request.buyerCompanyId())
                .productId(product.getId())
                .categoryId(request.categoryId() == null ? product.getCategoryId() : request.categoryId())
                .title(product.getName())
                .description(normalizeText(request.description()))
                .quantity(request.quantity())
                .unit(normalizeText(request.unit()) == null ? product.getUnit() : normalizeText(request.unit()))
                .deliveryDate(request.deliveryDate())
                .province(normalizeText(request.province()))
                .expiredAt(request.expiredAt())
                .status(RfqStatusEnum.OPEN)
                .createdAt(LocalDateTime.now())
                .build();
        return rfqRepository.save(rfq).getId();
    }

    private List<BuyerSourcingProductDto> buildProductDtos(List<ProductEntity> products) {
        if (products.isEmpty()) {
            return List.of();
        }

        List<Long> productIds = products.stream().map(ProductEntity::getId).filter(Objects::nonNull).toList();
        Map<Long, List<BatchEntity>> availableBatchesByProduct = batchRepository.findByProductIdInOrderByCreatedAtDesc(productIds)
                .stream()
                .filter(batch -> BatchStatusEnum.AVAILABLE.equals(batch.getStatus()))
                .collect(Collectors.groupingBy(BatchEntity::getProductId, LinkedHashMap::new, Collectors.toList()));

        Map<Long, String> productImageByProduct = firstProductImages(productIds);
        Map<Long, String> batchImageByProduct = firstBatchImages(availableBatchesByProduct.values().stream()
                .flatMap(Collection::stream)
                .toList());
        Map<Long, Long> certificationCountByProduct = productCertificationRepository.findByProduct_IdIn(productIds)
                .stream()
                .map(ProductCertificationEntity::getProduct)
                .filter(Objects::nonNull)
                .map(ProductEntity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(id -> id, Collectors.counting()));
        Map<Long, CompanyEntity> supplierById = companyRepository.findAllById(products.stream()
                        .map(ProductEntity::getSupplierCompanyId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(CompanyEntity::getId, value -> value, (left, right) -> left));
        Map<Long, CategoryEntity> categoryById = categoryRepository.findAllById(products.stream()
                        .map(ProductEntity::getCategoryId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(CategoryEntity::getId, value -> value, (left, right) -> left));

        return products.stream()
                .sorted(Comparator.comparing(ProductEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(product -> toDto(
                        product,
                        availableBatchesByProduct.getOrDefault(product.getId(), List.of()),
                        supplierById.get(product.getSupplierCompanyId()),
                        categoryById.get(product.getCategoryId()),
                        productImageByProduct.get(product.getId()),
                        batchImageByProduct.get(product.getId()),
                        certificationCountByProduct.getOrDefault(product.getId(), 0L)))
                .toList();
    }

    private BuyerSourcingProductDto toDto(
            ProductEntity product,
            List<BatchEntity> batches,
            CompanyEntity supplier,
            CategoryEntity category,
            String productImage,
            String batchImage,
            long certificationCount) {
        BigDecimal totalQuantity = batches.stream()
                .map(BatchEntity::getQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal minMoq = batches.stream()
                .map(BatchEntity::getMoq)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
        BigDecimal minPrice = batches.stream()
                .map(BatchEntity::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
        BigDecimal maxPrice = batches.stream()
                .map(BatchEntity::getPrice)
                .filter(Objects::nonNull)
                .max(BigDecimal::compareTo)
                .orElse(null);

        return new BuyerSourcingProductDto(
                product.getId(),
                safeText(product.getName()),
                safeText(product.getDescription()),
                product.getSupplierCompanyId(),
                supplier == null ? "Nhà cung cấp" : safeText(supplier.getName()),
                product.getCategoryId(),
                category == null ? "N/A" : safeText(category.getName()),
                safeText(product.getOriginProvince()),
                safeText(product.getUnit()),
                productImage != null ? productImage : (batchImage != null ? batchImage : PLACEHOLDER_IMAGE),
                minPrice,
                maxPrice,
                totalQuantity,
                minMoq,
                batches.size(),
                summarizeDistinct(batches.stream().map(BatchEntity::getGrade).toList()),
                summarizeDistinct(batches.stream().map(BatchEntity::getSize).toList()),
                certificationCount,
                !batches.isEmpty() && totalQuantity.compareTo(BigDecimal.ZERO) > 0,
                false);
    }

    private Map<Long, String> firstProductImages(Collection<Long> productIds) {
        Map<Long, String> result = new LinkedHashMap<>();
        for (ProductImageEntity image : productImageRepository.findByProductIdIn(productIds)) {
            result.putIfAbsent(image.getProductId(), image.getImageUrl());
        }
        return result;
    }

    private Map<Long, String> firstBatchImages(List<BatchEntity> batches) {
        List<Long> batchIds = batches.stream().map(BatchEntity::getId).filter(Objects::nonNull).toList();
        if (batchIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> productByBatchId = batches.stream()
                .filter(batch -> batch.getId() != null)
                .collect(Collectors.toMap(BatchEntity::getId, BatchEntity::getProductId, (left, right) -> left));
        Map<Long, String> result = new LinkedHashMap<>();
        for (BatchImageEntity image : batchImageRepository.findByBatchIdInOrderByUploadedAtDesc(batchIds)) {
            Long productId = productByBatchId.get(image.getBatchId());
            if (productId != null) {
                result.putIfAbsent(productId, image.getImageUrl());
            }
        }
        return result;
    }

    private String summarizeDistinct(List<String> values) {
        Set<String> distinct = values.stream()
                .map(this::normalizeText)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (distinct.isEmpty()) {
            return "--";
        }
        if (distinct.size() <= 3) {
            return String.join(", ", distinct);
        }
        List<String> first = new ArrayList<>(distinct).subList(0, 3);
        return String.join(", ", first) + "+";
    }

    private String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String safeText(String value) {
        return value == null || value.isBlank() ? "N/A" : value;
    }
}
