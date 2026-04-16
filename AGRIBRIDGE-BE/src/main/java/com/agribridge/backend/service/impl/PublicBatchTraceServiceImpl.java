package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.PublicBatchTraceResponseDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.ProductCertificationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QcRecordEntity;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.ProductCertificationRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QcRecordRepository;
import com.agribridge.backend.service.PublicBatchTraceService;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PublicBatchTraceServiceImpl implements PublicBatchTraceService {

    private final BatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final QcRecordRepository qcRecordRepository;
    private final ProductCertificationRepository productCertificationRepository;

    @Override
    @Transactional(readOnly = true)
    public PublicBatchTraceResponseDto getPublicBatchTrace(Long batchId) {
        log.info("Loading public batch trace batchId={}", batchId);
        BatchEntity batch = Objects.requireNonNull(batchRepository.findById(Objects.requireNonNull(batchId))
                .orElseThrow(() -> new IllegalArgumentException("Batch not found")));

        ProductEntity product = Objects.requireNonNull(productRepository.findById(Objects.requireNonNull(batch.getProductId()))
                .orElseThrow(() -> new IllegalArgumentException("Product not found")));

        CategoryEntity category = Objects.requireNonNull(categoryRepository.findById(Objects.requireNonNull(product.getCategoryId()))
                .orElseThrow(() -> new IllegalArgumentException("Category not found")));

        QcRecordEntity qc = qcRecordRepository.findTopByBatchIdOrderByCreatedAtDesc(Objects.requireNonNull(batch.getId())).orElse(null);
        List<ProductCertificationEntity> certifications = productCertificationRepository
                .findByProduct_IdOrderByCreatedAtDesc(Objects.requireNonNull(product.getId()));

        String qrCode = batch.getQrCode();
        if (qrCode == null || qrCode.isBlank()) {
            qrCode = String.format(Locale.ROOT, "/public/batch/%d", Objects.requireNonNull(batch.getId()));
        }

        PublicBatchTraceResponseDto response = new PublicBatchTraceResponseDto(
                new PublicBatchTraceResponseDto.ProductTraceDto(
                        product.getId(),
                        product.getName(),
                        category.getName(),
                        product.getOriginProvince(),
                        product.getDescription(),
                        product.getUnit()),
                new PublicBatchTraceResponseDto.BatchTraceDto(
                        batch.getId(),
                        String.format(Locale.ROOT, "BATCH-%06d", batch.getId()),
                        qrCode,
                        batch.getHarvestDate(),
                        batch.getExpiryDate(),
                        batch.getGrade(),
                        batch.getSize(),
                        batch.getQuantity(),
                        batch.getPrice(),
                        batch.getMoq(),
                        batch.getStorageTemp(),
                        batch.getVideoUrl(),
                        batch.getStatus().name()),
                qc == null
                        ? null
                        : new PublicBatchTraceResponseDto.QcTraceDto(
                                qc.getResult(),
                                qc.getDocumentUrl(),
                                qc.getNotes()),
                certifications.stream()
                        .map(certification -> new PublicBatchTraceResponseDto.CertificationTraceDto(
                                certification.getName(),
                                certification.getDocumentUrl(),
                                certification.getIssuedBy(),
                                certification.getIssuedDate(),
                                certification.getExpiryDate()))
                        .toList());
        log.info("Loaded public batch trace batchId={} productId={} certificationCount={}",
                batchId, product.getId(), certifications.size());
        return response;
    }
}
