package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CreateBatchDto;
import com.agribridge.backend.dto.CreateBatchForProductDto;
import com.agribridge.backend.dto.CreateProductCertificationDto;
import com.agribridge.backend.dto.CreateProductDto;
import com.agribridge.backend.dto.CreateProductOnlyDto;
import com.agribridge.backend.dto.CreateProductWithFirstBatchDto;
import com.agribridge.backend.dto.SupplierBatchCardDto;
import com.agribridge.backend.dto.SupplierBatchDetailDto;
import com.agribridge.backend.dto.SupplierCreateFlowResponseDto;
import com.agribridge.backend.dto.SupplierProductDetailDto;
import com.agribridge.backend.dto.SupplierProductOptionDto;
import com.agribridge.backend.dto.UpdateBatchDto;
import com.agribridge.backend.dto.UpdateProductDto;
import com.agribridge.backend.entity.BatchExpiryAuditEntity;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BatchImageEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductCertificationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ProductImageEntity;
import com.agribridge.backend.entity.QcRecordEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.BatchExpiryAuditRepository;
import com.agribridge.backend.repository.BatchImageRepository;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.MarketPriceSnapshotRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.ProductCertificationRepository;
import com.agribridge.backend.repository.ProductImageRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QcRecordRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.SupplierMetadataService;
import com.agribridge.backend.service.SupplierProductBatchService;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierProductBatchServiceImpl implements SupplierProductBatchService {

    private static final Set<String> ALLOWED_GRADES = Set.of("A", "B", "C");

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;
    private final BatchExpiryAuditRepository batchExpiryAuditRepository;
    private final BatchRepository batchRepository;
    private final BatchImageRepository batchImageRepository;
    private final QcRecordRepository qcRecordRepository;
    private final ProductImageRepository productImageRepository;
    private final ProductCertificationRepository productCertificationRepository;
    private final OrderItemRepository orderItemRepository;
    private final QuoteRepository quoteRepository;
    private final ComplaintRepository complaintRepository;
    private final RfqRepository rfqRepository;
    private final MarketPriceSnapshotRepository marketPriceSnapshotRepository;
    private final SupplierMetadataService supplierMetadataService;

    @Value("${app.public-base-url:http://localhost:5173}")
    private String publicBaseUrl;

    @Override
    @Transactional
    public SupplierCreateFlowResponseDto createProductOnly(CreateProductOnlyDto request) {
        log.info("Creating product only supplierCompanyId={} categoryId={}",
                request.supplierCompanyId(),
                request.product() == null ? null : request.product().categoryId());
        CompanyEntity supplierCompany = validateSupplierCompany(request.supplierCompanyId());
        CategoryEntity category = getCategory(request.product().categoryId());

        ProductEntity product = createProduct(request.product(), supplierCompany.getId(), category.getId());
        List<ProductCertificationEntity> certifications = productCertificationRepository
                .findByProduct_IdOrderByCreatedAtDesc(product.getId());

        SupplierCreateFlowResponseDto response = toCreateFlowResponse(product, category.getName(),
                firstImageUrl(product.getId()), null, null,
                certifications);
        log.info("Created product only productId={} supplierCompanyId={}", product.getId(), supplierCompany.getId());
        return response;
    }

    @Override
    @Transactional
    public SupplierCreateFlowResponseDto createProductWithFirstBatch(CreateProductWithFirstBatchDto request) {
        log.info("Creating product with first batch supplierCompanyId={} userId={}",
                request.supplierCompanyId(), request.userId());
        CompanyEntity supplierCompany = validateSupplierCompany(request.supplierCompanyId());
        CategoryEntity category = getCategory(request.product().categoryId());

        ProductEntity product = createProduct(request.product(), supplierCompany.getId(), category.getId());
        BatchAndQc batchAndQc = createBatchAndQc(product.getId(), request.userId(), request.batch());

        List<ProductCertificationEntity> certifications = productCertificationRepository
                .findByProduct_IdOrderByCreatedAtDesc(product.getId());

        SupplierCreateFlowResponseDto response = toCreateFlowResponse(
                product,
                category.getName(),
                firstImageUrl(product.getId()),
                batchAndQc.batch,
                batchAndQc.qc,
                certifications);
        log.info("Created product with first batch productId={} batchId={}", product.getId(), batchAndQc.batch.getId());
        return response;
    }

    @Override
    @Transactional
    public SupplierCreateFlowResponseDto createBatchForExistingProduct(CreateBatchForProductDto request) {
        log.info("Creating batch for existing product productId={} userId={}", request.productId(), request.userId());
        ProductEntity product = getProduct(request.productId());
        BatchAndQc batchAndQc = createBatchAndQc(product.getId(), request.userId(), request.batch());
        CategoryEntity category = getCategory(product.getCategoryId());
        List<ProductCertificationEntity> certifications = productCertificationRepository
                .findByProduct_IdOrderByCreatedAtDesc(product.getId());

        SupplierCreateFlowResponseDto response = toCreateFlowResponse(
                product,
                category.getName(),
                firstImageUrl(product.getId()),
                batchAndQc.batch,
                batchAndQc.qc,
                certifications);
        log.info("Created batch for existing product productId={} batchId={}", product.getId(),
                batchAndQc.batch.getId());
        return response;
    }

    @Override
    @Transactional
    public SupplierCreateFlowResponseDto updateProduct(Long productId, UpdateProductDto request) {
        log.info("Updating product productId={}", productId);
        ProductEntity product = getProduct(productId);
        CreateProductDto dto = request.product();

        validateUnit(dto.unit());
        validateProvince(dto.originProvince());
        validateCertifications(dto.certifications());

        getCategory(dto.categoryId());

        product.setName(dto.name().trim());
        product.setCategoryId(dto.categoryId());
        product.setDescription(normalizeOptional(dto.description()));
        product.setUnit(dto.unit().trim().toLowerCase(Locale.ROOT));
        product.setOriginProvince(dto.originProvince().trim());
        product = Objects.requireNonNull(productRepository.save(product));

        syncProductCertifications(product, dto.certifications());
        syncProductImages(Objects.requireNonNull(product.getId()), dto);

        CategoryEntity category = getCategory(product.getCategoryId());
        BatchEntity latestBatch = batchRepository.findByProductIdOrderByCreatedAtDesc(productId).stream().findFirst()
                .orElse(null);
        QcRecordEntity latestQc = latestBatch == null
                ? null
                : qcRecordRepository.findTopByBatchIdOrderByCreatedAtDesc(Objects.requireNonNull(latestBatch.getId()))
                        .orElse(null);

        SupplierCreateFlowResponseDto response = toCreateFlowResponse(
                product,
                category.getName(),
                firstImageUrl(Objects.requireNonNull(product.getId())),
                latestBatch,
                latestQc,
                productCertificationRepository
                        .findByProduct_IdOrderByCreatedAtDesc(Objects.requireNonNull(product.getId())));
        log.info("Updated product productId={}", productId);
        return response;
    }

    @Override
    @Transactional
    public SupplierCreateFlowResponseDto updateBatch(Long batchId, UpdateBatchDto request) {
        log.info("Updating batch batchId={} userId={}", batchId, request.userId());
        BatchEntity batch = Objects.requireNonNull(batchRepository.findById(Objects.requireNonNull(batchId))
                .orElseThrow(() -> new IllegalArgumentException("Batch not found")));

        CreateBatchDto dto = request.batch();
        validateDates(dto);
        validateExpiryChange(batch, dto.expiryDate(), request.userId());
        validateVideoUrl(dto.videoUrl());
        validateStorageTemp(dto.storageTemp());
        validateQcRules(dto);

        batch.setHarvestDate(dto.harvestDate());
        batch.setExpiryDate(dto.expiryDate());
        batch.setGrade(normalizeGrade(dto.grade()));
        batch.setSize(normalizeOptional(dto.size()));
        batch.setQuantity(dto.quantity());
        batch.setPrice(dto.price());
        batch.setMoq(defaultMoq(dto.moq()));
        batch.setStorageTemp(normalizeOptional(dto.storageTemp()));
        batch.setVideoUrl(normalizeOptional(dto.videoUrl()));
        batch = Objects.requireNonNull(batchRepository.save(Objects.requireNonNull(batch)));

        if (dto.imageUrls() != null) {
            syncBatchImages(Objects.requireNonNull(batch.getId()), dto.imageUrls());
        }

        if (dto.imageUrls() != null) {
            syncBatchImages(Objects.requireNonNull(batch.getId()), dto.imageUrls());
        }

        QcRecordEntity qc = upsertBatchQc(Objects.requireNonNull(batch.getId()), request.userId(), dto);

        ProductEntity product = getProduct(Objects.requireNonNull(batch.getProductId()));
        CategoryEntity category = getCategory(product.getCategoryId());

        SupplierCreateFlowResponseDto response = toCreateFlowResponse(
                product,
                category.getName(),
                firstImageUrl(Objects.requireNonNull(product.getId())),
                batch,
                qc,
                productCertificationRepository
                        .findByProduct_IdOrderByCreatedAtDesc(Objects.requireNonNull(product.getId())));
        log.info("Updated batch batchId={} productId={}", batchId, product.getId());
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierProductDetailDto getSupplierProductDetail(Long productId) {
        log.info("Loading supplier product detail productId={}", productId);
        try {
            ProductEntity product = getProduct(productId);
            String categoryName = resolveCategoryName(product.getCategoryId());

            List<String> imageUrls = productImageRepository.findByProductIdOrderByUploadedAtDesc(productId)
                    .stream()
                    .map(ProductImageEntity::getImageUrl)
                    .toList();

            List<SupplierCreateFlowResponseDto.CertificationSummaryDto> certifications = productCertificationRepository
                    .findByProduct_IdOrderByCreatedAtDesc(productId)
                    .stream()
                    .map(certification -> new SupplierCreateFlowResponseDto.CertificationSummaryDto(
                            certification.getId(),
                            certification.getName(),
                            certification.getDocumentUrl(),
                            certification.getIssuedBy(),
                            certification.getIssuedDate(),
                            certification.getExpiryDate()))
                    .toList();

            SupplierProductDetailDto detail = new SupplierProductDetailDto(
                    product.getId(),
                    product.getSupplierCompanyId(),
                    product.getCategoryId(),
                    categoryName,
                    product.getName(),
                    product.getUnit(),
                    product.getOriginProvince(),
                    product.getDescription(),
                    imageUrls,
                    certifications,
                    getBatchesByProduct(productId));
            log.info("Loaded supplier product detail productId={} imageCount={} certificationCount={}",
                    productId, imageUrls.size(), certifications.size());
            return detail;
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Cannot load product detail for productId={}", productId, exception);
            throw new IllegalArgumentException("Cannot load product detail");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierBatchDetailDto getSupplierBatchDetail(Long batchId) {
        log.info("Loading supplier batch detail batchId={}", batchId);
        try {
            BatchEntity batch = Objects.requireNonNull(batchRepository.findById(Objects.requireNonNull(batchId))
                    .orElseThrow(() -> new IllegalArgumentException("Batch not found")));

            ProductEntity product = getProduct(Objects.requireNonNull(batch.getProductId()));

            List<String> imageUrls = batchImageRepository
                    .findByBatchIdOrderByUploadedAtDesc(Objects.requireNonNull(batch.getId()))
                    .stream()
                    .map(BatchImageEntity::getImageUrl)
                    .toList();

            QcRecordEntity qc = qcRecordRepository
                    .findTopByBatchIdOrderByCreatedAtDesc(Objects.requireNonNull(batch.getId())).orElse(null);

            SupplierBatchDetailDto detail = new SupplierBatchDetailDto(
                    batch.getId(),
                    product.getId(),
                    product.getName(),
                    product.getUnit(),
                    formatBatchCode(batch.getId()),
                    batch.getQrCode(),
                    batch.getHarvestDate(),
                    batch.getExpiryDate(),
                    batch.getGrade(),
                    batch.getSize(),
                    batch.getQuantity(),
                    batch.getPrice(),
                    batch.getMoq(),
                    batch.getStorageTemp(),
                    batch.getVideoUrl(),
                    resolveBatchStatus(batch),
                    resolveBatchStatusLabel(batch),
                    imageUrls,
                    qc == null ? null : qc.getResult(),
                    qc == null ? null : qc.getDocumentUrl(),
                    qc == null ? null : qc.getNotes(),
                    isExpired(batch),
                    expiryWarningMessage(batch),
                    daysUntilExpiry(batch),
                    soonExpiryWarning(batch),
                    canEditExpiry(batch),
                    Boolean.TRUE);
            log.info("Loaded supplier batch detail batchId={} productId={} imageCount={}",
                    batchId, product.getId(), imageUrls.size());
            return detail;
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Cannot load batch detail for batchId={}", batchId, exception);
            throw new IllegalArgumentException("Batch data is invalid");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupplierBatchCardDto> getBatchesByProduct(Long productId) {
        log.info("Loading batches by product productId={}", productId);
        try {
            List<BatchEntity> batches = batchRepository.findByProductIdOrderByCreatedAtDesc(productId);
            ProductEntity product = null;
            try {
                product = getProduct(productId);
            } catch (Exception exception) {
                log.warn("Cannot load product while loading batches for productId={}", productId, exception);
            }

            String image = null;
            try {
                image = firstImageUrl(productId);
            } catch (Exception exception) {
                log.warn("Cannot load product image while loading batches for productId={}", productId, exception);
            }
            final ProductEntity productForCard = product;
            final String imageForCard = image;

            List<SupplierBatchCardDto> cards = batches.stream()
                    .map(batch -> safeToBatchCard(batch, productForCard, imageForCard))
                    .filter(Objects::nonNull)
                    .toList();
            log.info("Loaded {} batches for productId={}", cards.size(), productId);
            return cards;
        } catch (Exception exception) {
            log.error("Cannot load batches for productId={}", productId, exception);
            return List.of();
        }
    }

    private String resolveBatchStatus(BatchEntity batch) {
        return batch.getStatus() == null ? BatchStatusEnum.AVAILABLE.name() : batch.getStatus().name();
    }

    private String resolveBatchStatusLabel(BatchEntity batch) {
        BatchStatusEnum status = batch == null ? null : batch.getStatus();
        if (isExpired(batch)) {
            return "Đã hết hạn";
        }
        if (status == null) {
            return "Còn hàng";
        }
        return switch (status) {
            case DRAFT -> "Nháp";
            case AVAILABLE -> "Còn hàng";
            case LOW_STOCK, RESERVED -> "Sắp hết";
            case EXPIRED -> "Đã hết hạn";
            case DISPOSED -> "Đã hủy";
            case HANDLED -> "Đã xử lý";
            case SOLD_OUT -> "Hết hàng";
        };
    }

    private boolean isExpired(BatchEntity batch) {
        return batch != null
                && (BatchStatusEnum.EXPIRED.equals(batch.getStatus())
                || (batch.getExpiryDate() != null && batch.getExpiryDate().isBefore(LocalDate.now())));
    }

    private String expiryWarningMessage(BatchEntity batch) {
        return isExpired(batch)
                ? "Lô hàng đã hết hạn và đã bị ẩn khỏi marketplace. Buyer không thể đặt mua lô này nữa."
                : null;
    }

    private Integer daysUntilExpiry(BatchEntity batch) {
        if (batch == null || batch.getExpiryDate() == null) {
            return null;
        }
        return (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), batch.getExpiryDate());
    }

    private String soonExpiryWarning(BatchEntity batch) {
        Integer days = daysUntilExpiry(batch);
        if (days == null || days < 0 || days > 3) {
            return null;
        }
        return "Lô hàng sắp hết hạn sau " + days + " ngày.";
    }

    private boolean canEditExpiry(BatchEntity batch) {
        if (batch == null || batch.getId() == null || isExpired(batch) || orderItemRepository.existsByBatchId(batch.getId())) {
            return false;
        }
        return BatchStatusEnum.DRAFT.equals(batch.getStatus())
                || BatchStatusEnum.AVAILABLE.equals(batch.getStatus())
                || BatchStatusEnum.LOW_STOCK.equals(batch.getStatus());
    }

    private SupplierBatchCardDto safeToBatchCard(BatchEntity batch, ProductEntity product, String imageUrl) {
        try {
            String productUnit = product == null ? null : product.getUnit();
            String productName = product == null ? null : product.getName();
            return new SupplierBatchCardDto(
                    batch.getId(),
                    formatBatchCode(batch.getId()),
                    batch.getQrCode(),
                    batch.getGrade(),
                    batch.getSize(),
                    batch.getQuantity(),
                    batch.getMoq(),
                    batch.getPrice(),
                    resolveBatchStatus(batch),
                    resolveBatchStatusLabel(batch),
                    batch.getHarvestDate(),
                    batch.getExpiryDate(),
                    productUnit,
                    productName,
                    imageUrl,
                    isExpired(batch),
                    expiryWarningMessage(batch),
                    daysUntilExpiry(batch),
                    soonExpiryWarning(batch),
                    canEditExpiry(batch),
                    Boolean.TRUE);
        } catch (Exception exception) {
            log.error("Skip invalid batch row for batchId={} productId={}",
                    batch == null ? null : batch.getId(),
                    product == null ? null : product.getId(),
                    exception);
            return null;
        }
    }

    private String resolveCategoryName(Long categoryId) {
        if (categoryId == null) {
            return "Chua phan loai";
        }
        return categoryRepository.findById(categoryId)
                .map(CategoryEntity::getName)
                .orElse("Chua phan loai");
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupplierProductOptionDto> getSupplierProducts(Long supplierCompanyId) {
        log.info("Loading supplier products supplierCompanyId={}", supplierCompanyId);
        if (supplierCompanyId == null) {
            log.warn("Returning empty supplier products because supplierCompanyId is null");
            return List.of();
        }

        List<ProductEntity> products = productRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(supplierCompanyId);
        Map<Long, String> categoryNameById = loadCategoryNames(products);

        List<SupplierProductOptionDto> options = new ArrayList<>();
        for (ProductEntity product : products) {
            options.add(new SupplierProductOptionDto(
                    product.getId(),
                    product.getName(),
                    product.getCategoryId(),
                    categoryNameById.get(product.getCategoryId()),
                    product.getUnit(),
                    product.getOriginProvince(),
                    firstImageUrl(product.getId())));
        }

        log.info("Loaded {} supplier products for supplierCompanyId={}", options.size(), supplierCompanyId);
        return options;
    }

    @Override
    @Transactional
    public void deleteProduct(Long productId) {
        log.info("Deleting product productId={}", productId);
        ProductEntity product = getProduct(productId);
        List<BatchEntity> batches = batchRepository.findByProductIdOrderByCreatedAtDesc(productId);
        List<Long> batchIds = batches.stream()
                .map(BatchEntity::getId)
                .filter(Objects::nonNull)
                .toList();

        if (!batchIds.isEmpty() && orderItemRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa san pham vi da co don hang lien ket voi lo hang.");
        }
        if (!batchIds.isEmpty() && quoteRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa san pham vi da co bao gia lien ket voi lo hang.");
        }
        if (!batchIds.isEmpty() && complaintRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa san pham vi da co khieu nai lien ket voi lo hang.");
        }
        if (marketPriceSnapshotRepository.existsByProductId(productId)) {
            throw new IllegalArgumentException("Khong the xoa san pham vi da co lich su gia thi truong lien ket.");
        }

        for (BatchEntity batch : batches) {
            Long batchEntityId = Objects.requireNonNull(batch.getId());
            qcRecordRepository.deleteByBatchId(batchEntityId);
            batchImageRepository.deleteByBatchId(batchEntityId);
            batchRepository.deleteById(batchEntityId);
        }

        productImageRepository.deleteByProductId(productId);
        productCertificationRepository.deleteByProduct_Id(Objects.requireNonNull(productId));
        int detachedRfqCount = rfqRepository.clearProductReference(productId);
        productRepository.deleteById(Objects.requireNonNull(product.getId()));
        log.info("Deleted product productId={} deletedBatchCount={} detachedRfqCount={}", productId, batches.size(),
                detachedRfqCount);
    }

    @Override
    @Transactional
    public void deleteBatch(Long batchId) {
        log.info("Deleting batch batchId={}", batchId);
        BatchEntity batch = Objects.requireNonNull(batchRepository.findById(Objects.requireNonNull(batchId))
                .orElseThrow(() -> new IllegalArgumentException("Batch not found")));

        ensureBatchCanBeDeleted(batchId);
        qcRecordRepository.deleteByBatchId(Objects.requireNonNull(batchId));
        batchImageRepository.deleteByBatchId(Objects.requireNonNull(batchId));
        batchRepository.deleteById(Objects.requireNonNull(batch.getId()));
        log.info("Deleted batch batchId={} productId={}", batchId, batch.getProductId());
    }

    private void ensureBatchCanBeDeleted(Long batchId) {
        List<Long> batchIds = List.of(Objects.requireNonNull(batchId));
        if (orderItemRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa lo hang vi da co don hang lien ket.");
        }
        if (quoteRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa lo hang vi da co bao gia lien ket.");
        }
        if (complaintRepository.existsByBatchIdIn(batchIds)) {
            throw new IllegalArgumentException("Khong the xoa lo hang vi da co khieu nai lien ket.");
        }
    }

    private CompanyEntity validateSupplierCompany(Long supplierCompanyId) {
        CompanyEntity supplierCompany = Objects
                .requireNonNull(companyRepository.findById(Objects.requireNonNull(supplierCompanyId))
                        .orElseThrow(() -> new IllegalArgumentException("Supplier company not found")));
        if (supplierCompany.getCompanyType() != CompanyTypeEnum.SUPPLIER) {
            throw new IllegalArgumentException("Company must be supplier");
        }
        // Block sensitive actions when verification is still pending
        VerificationStatusEnum vs = supplierCompany.getVerificationStatus();
        if (vs == VerificationStatusEnum.PENDING_REVIEW || vs == VerificationStatusEnum.PENDING
                || vs == VerificationStatusEnum.DRAFT) {
            throw new IllegalArgumentException(
                    "H\u1ed3 s\u01a1 c\u1ee7a b\u1ea1n \u0111ang ch\u1edd duy\u1ec7t. Kh\u00f4ng th\u1ec3 \u0111\u0103ng s\u1ea3n ph\u1ea9m c\u00f4ng khai khi ch\u01b0a \u0111\u01b0\u1ee3c x\u00e1c minh.");
        }
        return supplierCompany;
    }

    private CategoryEntity getCategory(Long categoryId) {
        return Objects.requireNonNull(categoryRepository.findById(Objects.requireNonNull(categoryId))
                .orElseThrow(() -> new IllegalArgumentException("Category not found")));
    }

    private ProductEntity getProduct(Long productId) {
        return Objects.requireNonNull(productRepository.findById(Objects.requireNonNull(productId))
                .orElseThrow(() -> new IllegalArgumentException("Product not found")));
    }

    private ProductEntity createProduct(CreateProductDto dto, Long supplierCompanyId, Long categoryId) {
        validateUnit(dto.unit());
        validateProvince(dto.originProvince());
        validateCertifications(dto.certifications());

        ProductEntity product = ProductEntity.builder()
                .supplierCompanyId(supplierCompanyId)
                .categoryId(categoryId)
                .name(dto.name().trim())
                .description(normalizeOptional(dto.description()))
                .unit(dto.unit().trim().toLowerCase(Locale.ROOT))
                .originProvince(dto.originProvince().trim())
                .createdAt(LocalDateTime.now())
                .build();

        List<ProductCertificationEntity> certifications = new ArrayList<>();
        if (dto.certifications() != null) {
            for (CreateProductCertificationDto certDto : dto.certifications()) {
                ProductCertificationEntity certification = ProductCertificationEntity.builder()
                        .product(product)
                        .name(certDto.name().trim())
                        .documentUrl(normalizeOptional(certDto.documentUrl()))
                        .issuedBy(normalizeOptional(certDto.issuedBy()))
                        .issuedDate(certDto.issuedDate())
                        .expiryDate(certDto.expiryDate())
                        .createdAt(LocalDateTime.now())
                        .build();
                certifications.add(certification);
            }
        }
        product.setCertifications(certifications);
        product = Objects.requireNonNull(productRepository.save(product));

        saveProductImages(Objects.requireNonNull(product.getId()), dto);
        return product;
    }

    private void syncProductCertifications(ProductEntity product, List<CreateProductCertificationDto> certifications) {
        productCertificationRepository.deleteByProduct_Id(Objects.requireNonNull(product.getId()));
        if (certifications == null) {
            return;
        }

        List<ProductCertificationEntity> entities = certifications.stream()
                .map(certification -> ProductCertificationEntity.builder()
                        .product(product)
                        .name(certification.name().trim())
                        .documentUrl(normalizeOptional(certification.documentUrl()))
                        .issuedBy(normalizeOptional(certification.issuedBy()))
                        .issuedDate(certification.issuedDate())
                        .expiryDate(certification.expiryDate())
                        .createdAt(LocalDateTime.now())
                        .build())
                .toList();
        productCertificationRepository.saveAll(Objects.requireNonNull(entities));
    }

    private void syncProductImages(Long productId, CreateProductDto dto) {
        productImageRepository.deleteByProductId(productId);
        saveProductImages(productId, dto);
    }

    private void saveProductImages(Long productId, CreateProductDto dto) {
        List<String> imageUrls = collectImageUrls(dto);
        for (String imageUrl : imageUrls) {
            Objects.requireNonNull(productImageRepository.save(Objects.requireNonNull(ProductImageEntity.builder()
                    .productId(productId)
                    .imageUrl(imageUrl)
                    .uploadedAt(LocalDateTime.now())
                    .build())));
        }
    }

    private List<String> collectImageUrls(CreateProductDto dto) {
        LinkedHashSet<String> imageUrls = new LinkedHashSet<>();

        String singleImage = normalizeOptional(dto.imageUrl());
        if (singleImage != null) {
            imageUrls.add(singleImage);
        }

        if (dto.imageUrls() != null) {
            for (String imageUrl : dto.imageUrls()) {
                String normalized = normalizeOptional(imageUrl);
                if (normalized != null) {
                    imageUrls.add(normalized);
                }
            }
        }

        return imageUrls.stream().toList();
    }

    private BatchAndQc createBatchAndQc(Long productId, Long userId, CreateBatchDto dto) {
        validateDates(dto);
        validateVideoUrl(dto.videoUrl());
        validateStorageTemp(dto.storageTemp());
        validateQcRules(dto);

        BatchEntity batch = BatchEntity.builder()
                .productId(productId)
                .harvestDate(dto.harvestDate())
                .expiryDate(dto.expiryDate())
                .grade(normalizeGrade(dto.grade()))
                .size(normalizeOptional(dto.size()))
                .quantity(dto.quantity())
                .price(dto.price())
                .moq(defaultMoq(dto.moq()))
                .storageTemp(normalizeOptional(dto.storageTemp()))
                .videoUrl(normalizeOptional(dto.videoUrl()))
                .status(BatchStatusEnum.AVAILABLE)
                .createdAt(LocalDateTime.now())
                .build();
        batch = Objects.requireNonNull(batchRepository.save(Objects.requireNonNull(batch)));

        batch.setQrCode(buildPublicBatchUrl(Objects.requireNonNull(batch.getId())));
        batch = Objects.requireNonNull(batchRepository.save(batch));

        saveBatchImages(Objects.requireNonNull(batch.getId()), dto.imageUrls());

        QcRecordEntity qc = QcRecordEntity.builder()
                .batchId(Objects.requireNonNull(batch.getId()))
                .inspectorUserId(userId)
                .result(dto.qc().result())
                .documentUrl(normalizeOptional(dto.qc().documentUrl()))
                .notes(normalizeOptional(dto.qc().notes()))
                .createdAt(LocalDateTime.now())
                .build();
        qc = Objects.requireNonNull(qcRecordRepository.save(Objects.requireNonNull(qc)));

        return new BatchAndQc(batch, qc);
    }

    private void syncBatchImages(Long batchId, List<String> rawImageUrls) {
        batchImageRepository.deleteByBatchId(batchId);
        saveBatchImages(batchId, rawImageUrls);
    }

    private void saveBatchImages(Long batchId, List<String> rawImageUrls) {
        if (rawImageUrls == null) {
            return;
        }

        LinkedHashSet<String> imageUrls = new LinkedHashSet<>();
        for (String rawImageUrl : rawImageUrls) {
            String normalized = normalizeOptional(rawImageUrl);
            if (normalized != null) {
                imageUrls.add(normalized);
            }
        }

        for (String imageUrl : imageUrls) {
            Objects.requireNonNull(batchImageRepository.save(Objects.requireNonNull(BatchImageEntity.builder()
                    .batchId(batchId)
                    .imageUrl(imageUrl)
                    .uploadedAt(LocalDateTime.now())
                    .build())));
        }
    }

    private QcRecordEntity upsertBatchQc(Long batchId, Long userId, CreateBatchDto dto) {
        QcRecordEntity existing = qcRecordRepository
                .findTopByBatchIdOrderByCreatedAtDesc(Objects.requireNonNull(batchId)).orElse(null);
        if (existing == null) {
            return Objects.requireNonNull(qcRecordRepository.save(Objects.requireNonNull(QcRecordEntity.builder()
                    .batchId(batchId)
                    .inspectorUserId(userId)
                    .result(dto.qc().result())
                    .documentUrl(normalizeOptional(dto.qc().documentUrl()))
                    .notes(normalizeOptional(dto.qc().notes()))
                    .createdAt(LocalDateTime.now())
                    .build())));
        }

        existing.setInspectorUserId(userId);
        existing.setResult(dto.qc().result());
        existing.setDocumentUrl(normalizeOptional(dto.qc().documentUrl()));
        existing.setNotes(normalizeOptional(dto.qc().notes()));
        return Objects.requireNonNull(qcRecordRepository.save(Objects.requireNonNull(existing)));
    }

    private SupplierCreateFlowResponseDto toCreateFlowResponse(
            ProductEntity product,
            String categoryName,
            String imageUrl,
            BatchEntity batch,
            QcRecordEntity qc,
            List<ProductCertificationEntity> certifications) {

        List<SupplierCreateFlowResponseDto.CertificationSummaryDto> certificationItems = certifications.stream()
                .map(certification -> new SupplierCreateFlowResponseDto.CertificationSummaryDto(
                        certification.getId(),
                        certification.getName(),
                        certification.getDocumentUrl(),
                        certification.getIssuedBy(),
                        certification.getIssuedDate(),
                        certification.getExpiryDate()))
                .toList();

        SupplierCreateFlowResponseDto.BatchSummaryDto batchSummary = batch == null ? null
                : new SupplierCreateFlowResponseDto.BatchSummaryDto(
                        batch.getId(),
                        formatBatchCode(batch.getId()),
                        batch.getQrCode(),
                        batch.getHarvestDate(),
                        batch.getExpiryDate(),
                        batch.getGrade(),
                        batch.getSize(),
                        batch.getQuantity(),
                        batch.getPrice(),
                        batch.getMoq(),
                        batch.getStorageTemp(),
                        batch.getVideoUrl(),
                        resolveBatchStatus(batch),
                        resolveBatchStatusLabel(batch),
                        isExpired(batch),
                        expiryWarningMessage(batch),
                        daysUntilExpiry(batch),
                        soonExpiryWarning(batch),
                        canEditExpiry(batch),
                        Boolean.TRUE);

        SupplierCreateFlowResponseDto.QcSummaryDto qcSummary = qc == null ? null
                : new SupplierCreateFlowResponseDto.QcSummaryDto(
                        qc.getId(),
                        qc.getResult(),
                        qc.getDocumentUrl(),
                        qc.getNotes());

        return new SupplierCreateFlowResponseDto(
                new SupplierCreateFlowResponseDto.ProductSummaryDto(
                        product.getId(),
                        product.getName(),
                        product.getUnit(),
                        product.getCategoryId(),
                        categoryName,
                        product.getOriginProvince(),
                        product.getDescription(),
                        imageUrl),
                batchSummary,
                qcSummary,
                certificationItems);
    }

    private void validateUnit(String unit) {
        if (!supplierMetadataService.isAllowedUnit(unit)) {
            throw new IllegalArgumentException("Unit is invalid. Please select from allowed list");
        }
    }

    private void validateProvince(String province) {
        if (!supplierMetadataService.isValidProvince(province)) {
            throw new IllegalArgumentException("Origin province is invalid");
        }
    }

    private void validateCertifications(List<CreateProductCertificationDto> certifications) {
        if (certifications == null) {
            return;
        }
        LocalDate today = LocalDate.now();

        for (CreateProductCertificationDto certification : certifications) {
            if (certification.issuedDate() == null) {
                throw new IllegalArgumentException("Issued date is required for certification");
            }
            if (certification.issuedDate().isAfter(today)) {
                throw new IllegalArgumentException("Issued date cannot be in the future");
            }
            if (certification.expiryDate() == null) {
                throw new IllegalArgumentException("Expiry date is required for certification");
            }
            if (certification.expiryDate().isBefore(today)) {
                throw new IllegalArgumentException("Expiry date cannot be in the past");
            }
            if (!certification.expiryDate().isAfter(certification.issuedDate())) {
                throw new IllegalArgumentException("Certification expiry date must be after issued date");
            }
        }
    }

    private void validateDates(CreateBatchDto dto) {
        LocalDate today = LocalDate.now();
        if (dto.harvestDate() == null) {
            throw new IllegalArgumentException("Harvest date is required");
        }
        if (dto.harvestDate().isAfter(today)) {
            throw new IllegalArgumentException("Harvest date cannot be in the future");
        }
        if (dto.expiryDate() == null) {
            throw new IllegalArgumentException("Expiry date is required");
        }
        if (dto.expiryDate().isBefore(today)) {
            throw new IllegalArgumentException("Expiry date cannot be in the past");
        }
        if (!dto.expiryDate().isAfter(dto.harvestDate())) {
            throw new IllegalArgumentException("Expiry date must be after harvest date");
        }
    }

    private void validateExpiryChange(BatchEntity batch, LocalDate newExpiryDate, Long changedByUserId) {
        if (Objects.equals(batch.getExpiryDate(), newExpiryDate)) {
            return;
        }

        boolean hasOrder = batch.getId() != null && orderItemRepository.existsByBatchId(batch.getId());
        boolean expired = BatchStatusEnum.EXPIRED.equals(batch.getStatus())
                || (batch.getExpiryDate() != null && batch.getExpiryDate().isBefore(LocalDate.now()));
        boolean editableStatus = BatchStatusEnum.DRAFT.equals(batch.getStatus())
                || BatchStatusEnum.AVAILABLE.equals(batch.getStatus())
                || BatchStatusEnum.LOW_STOCK.equals(batch.getStatus());

        if (hasOrder || expired || !editableStatus) {
            throw new IllegalArgumentException(
                    "Không thể tự ý gia hạn ngày hết hạn cho lô hàng đã public, đã hết hạn hoặc đã phát sinh giao dịch. Vui lòng tạo lô mới hoặc gửi yêu cầu điều chỉnh.");
        }

        batchExpiryAuditRepository.save(BatchExpiryAuditEntity.builder()
                .batchId(batch.getId())
                .oldExpiryDate(batch.getExpiryDate())
                .newExpiryDate(newExpiryDate)
                .changedByUserId(changedByUserId)
                .reason("Supplier updated expiry date before expiry and before any order")
                .changedAt(LocalDateTime.now())
                .build());
    }

    private String normalizeGrade(String grade) {
        String normalized = grade == null ? "" : grade.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_GRADES.contains(normalized)) {
            throw new IllegalArgumentException("Grade must be one of A, B, C");
        }
        return normalized;
    }

    private void validateStorageTemp(String storageTemp) {
        if (storageTemp == null || storageTemp.isBlank()) {
            return;
        }
        String regex = "^-?\\d{1,2}(?:\\.\\d)?\\s*°?C(?:\\s*(?:-|to)\\s*-?\\d{1,2}(?:\\.\\d)?\\s*°?C)?$";
        if (!storageTemp.trim().matches(regex)) {
            throw new IllegalArgumentException("Storage temperature format is invalid");
        }
    }

    private void validateVideoUrl(String videoUrl) {
        if (videoUrl == null || videoUrl.isBlank()) {
            return;
        }
        try {
            URI uri = URI.create(videoUrl.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new IllegalArgumentException("Video URL is invalid");
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("Video URL is invalid");
        }
    }

    private void validateQcRules(CreateBatchDto dto) {
        String documentUrl = normalizeOptional(dto.qc().documentUrl());
        String notes = normalizeOptional(dto.qc().notes());

        if (dto.qc().result() == null) {
            throw new IllegalArgumentException("QC result is required");
        }

        switch (dto.qc().result()) {
            case PASS -> {
                if (documentUrl == null) {
                    throw new IllegalArgumentException("QC file is required when result is PASS");
                }
            }
            case FAIL -> {
                if (notes == null) {
                    throw new IllegalArgumentException("QC notes are required when result is FAIL");
                }
            }
            default -> {
            }
        }
    }

    private Map<Long, String> loadCategoryNames(List<ProductEntity> products) {
        List<Long> categoryIds = products.stream()
                .map(ProductEntity::getCategoryId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> categoryNameById = new LinkedHashMap<>();
        if (categoryIds.isEmpty()) {
            return categoryNameById;
        }
        for (CategoryEntity category : categoryRepository.findAllById(categoryIds)) {
            categoryNameById.put(category.getId(), category.getName());
        }
        return categoryNameById;
    }

    private String firstImageUrl(Long productId) {
        return productImageRepository.findTopByProductIdOrderByUploadedAtDesc(productId)
                .map(ProductImageEntity::getImageUrl)
                .orElse(null);
    }

    private BigDecimal defaultMoq(BigDecimal moq) {
        return moq == null ? BigDecimal.ZERO : moq;
    }

    private String formatBatchCode(Long batchId) {
        return String.format(Locale.ROOT, "BATCH-%06d", batchId);
    }

    private String buildPublicBatchUrl(Long batchId) {
        String base = publicBaseUrl == null ? "http://localhost:5173" : publicBaseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/public/batch/" + batchId;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record BatchAndQc(BatchEntity batch, QcRecordEntity qc) {
    }
}
