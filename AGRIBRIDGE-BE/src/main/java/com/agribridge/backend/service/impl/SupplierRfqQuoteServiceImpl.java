package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CreateSupplierQuoteDto;
import com.agribridge.backend.dto.RejectSupplierRfqDto;
import com.agribridge.backend.dto.SupplierQuoteContextDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.SupplierRfqQuoteService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierRfqQuoteServiceImpl implements SupplierRfqQuoteService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String TERMINAL_QUOTE_MESSAGE = "Không thể sửa báo giá đã được chấp nhận hoặc từ chối.";

    private final QuoteRepository quoteRepository;
    private final RfqRepository rfqRepository;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final BatchAvailabilityService batchAvailabilityService;

    @Override
    @Transactional(readOnly = true)
    public SupplierQuoteContextDto getQuoteContext(Long rfqId) {
        RfqEntity rfq = rfqRepository.findById(rfqId)
                .orElseThrow(() -> new IllegalArgumentException("RFQ does not exist"));
        ProductEntity product = rfq.getProductId() == null
                ? null
                : productRepository.findById(rfq.getProductId()).orElse(null);
        String unit = rfq.getUnit() == null || rfq.getUnit().isBlank()
                ? (product == null ? null : product.getUnit())
                : rfq.getUnit();
        List<SupplierQuoteContextDto.BatchContextDto> batches = rfq.getProductId() == null
                ? List.of()
                : batchRepository.findByProductIdOrderByCreatedAtDesc(rfq.getProductId())
                        .stream()
                        .filter(batchAvailabilityService::isBuyerVisible)
                        .map(batch -> toBatchContext(batch, unit))
                        .toList();

        return new SupplierQuoteContextDto(
                new SupplierQuoteContextDto.RfqContextDto(
                        rfq.getId(),
                        rfq.getBuyerCompanyId(),
                        rfq.getProductId(),
                        rfq.getCategoryId(),
                        rfq.getQuantity(),
                        unit,
                        rfq.getDeliveryDate(),
                        rfq.getProvince(),
                        rfq.getDescription(),
                        rfq.getExpiredAt(),
                        rfq.getStatus() == null ? null : rfq.getStatus().name()),
                product == null ? null : new SupplierQuoteContextDto.ProductContextDto(
                        product.getId(),
                        product.getName(),
                        product.getCategoryId(),
                        product.getUnit()),
                batches);
    }

    @Override
    @Transactional
    public void createOrUpdateQuote(Long rfqId, CreateSupplierQuoteDto request) {
        log.info("Create/update supplier quote rfqId={} supplierCompanyId={}", rfqId, request.supplierCompanyId());
        QuoteEntity existingQuote = quoteRepository
                .findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(request.supplierCompanyId(), rfqId)
                .orElse(null);
        ensureQuoteCanStillChange(existingQuote);

        RfqEntity rfq = validateRfq(rfqId);
        validateSupplierCanRespond(request.supplierCompanyId(), rfq);

        QuoteEntity quote = existingQuote == null ? new QuoteEntity() : existingQuote;

        quote.setRfqId(rfqId);
        quote.setSupplierCompanyId(request.supplierCompanyId());
        quote.setBatchId(validateSelectedBatch(request.batchId(), rfq, request.quantity()));
        quote.setPrice(request.price());
        quote.setQuantity(request.quantity());
        quote.setDeliveryDays(request.deliveryDays());
        quote.setNote(normalizeNote(request.note()));
        quote.setStatus(STATUS_PENDING);
        if (quote.getCreatedAt() == null) {
            quote.setCreatedAt(LocalDateTime.now());
        }
        quoteRepository.save(quote);
    }

    private Long validateSelectedBatch(Long batchId, RfqEntity rfq, BigDecimal quoteQuantity) {
        if (batchId == null) {
            return null;
        }

        BatchEntity batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Selected batch does not exist"));
        if (rfq.getProductId() == null || !rfq.getProductId().equals(batch.getProductId())) {
            throw new IllegalArgumentException("Selected batch does not belong to this RFQ product");
        }
        batchAvailabilityService.validateOrderable(batch, rfq.getProductId(), quoteQuantity);
        return batchId;
    }

    private SupplierQuoteContextDto.BatchContextDto toBatchContext(BatchEntity batch, String fallbackUnit) {
        return new SupplierQuoteContextDto.BatchContextDto(
                batch.getId(),
                batch.getProductId(),
                batch.getQuantity(),
                fallbackUnit,
                batch.getPrice(),
                batch.getGrade(),
                batch.getSize(),
                batch.getHarvestDate(),
                batch.getExpiryDate(),
                batch.getStorageTemp(),
                batch.getStatus() == null ? null : batch.getStatus().name());
    }

    @Override
    @Transactional
    public void rejectRfq(Long rfqId, RejectSupplierRfqDto request) {
        log.info("Reject supplier rfq rfqId={} supplierCompanyId={}", rfqId, request.supplierCompanyId());
        QuoteEntity existingQuote = quoteRepository
                .findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(request.supplierCompanyId(), rfqId)
                .orElse(null);
        ensureQuoteCanStillChange(existingQuote);

        RfqEntity rfq = validateRfq(rfqId);
        validateSupplierCanRespond(request.supplierCompanyId(), rfq);

        QuoteEntity quote = existingQuote == null ? new QuoteEntity() : existingQuote;

        quote.setRfqId(rfqId);
        quote.setSupplierCompanyId(request.supplierCompanyId());
        quote.setPrice(quote.getPrice() == null ? BigDecimal.ZERO : quote.getPrice());
        quote.setQuantity(rfq.getQuantity() == null ? BigDecimal.ZERO : rfq.getQuantity());
        quote.setDeliveryDays(null);
        quote.setNote(normalizeNote(request.note()));
        quote.setStatus(STATUS_REJECTED);
        quote.setCreatedAt(LocalDateTime.now());
        quoteRepository.save(quote);
    }

    private void ensureQuoteCanStillChange(QuoteEntity quote) {
        if (quote == null || quote.getStatus() == null || STATUS_PENDING.equalsIgnoreCase(quote.getStatus())) {
            return;
        }
        throw new IllegalArgumentException(TERMINAL_QUOTE_MESSAGE);
    }

    private RfqEntity validateRfq(Long rfqId) {
        RfqEntity rfq = rfqRepository.findById(rfqId)
                .orElseThrow(() -> new IllegalArgumentException("RFQ does not exist"));
        if (!RfqStatusEnum.OPEN.equals(rfq.getStatus())) {
            throw new IllegalArgumentException("RFQ is not open");
        }
        if (rfq.getExpiredAt() != null && !rfq.getExpiredAt().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("RFQ has expired");
        }
        return rfq;
    }

    private void validateSupplierCanRespond(Long supplierCompanyId, RfqEntity rfq) {
        CompanyEntity supplier = companyRepository.findById(supplierCompanyId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier company does not exist"));

        List<ProductEntity> products = productRepository.findBySupplierCompanyId(supplierCompanyId);
        boolean matchesProduct = rfq.getProductId() != null
                && products.stream().anyMatch(product -> rfq.getProductId().equals(product.getId()));
        boolean matchesCategory = rfq.getCategoryId() != null
                && products.stream().anyMatch(product -> rfq.getCategoryId().equals(product.getCategoryId()));
        boolean matchesProvince = normalizeKeyword(rfq.getProvince()) != null
                && products.stream().map(ProductEntity::getOriginProvince).map(this::normalizeKeyword)
                        .anyMatch(province -> province != null && province.equals(normalizeKeyword(rfq.getProvince())));

        if (!matchesProvince) {
            String supplierProvince = normalizeKeyword(supplier.getProvince());
            matchesProvince = supplierProvince != null && supplierProvince.equals(normalizeKeyword(rfq.getProvince()));
        }

        if (!matchesProduct && !matchesCategory && !matchesProvince) {
            throw new IllegalArgumentException("Supplier is not eligible to respond to this RFQ");
        }
    }

    private String normalizeKeyword(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }
}
