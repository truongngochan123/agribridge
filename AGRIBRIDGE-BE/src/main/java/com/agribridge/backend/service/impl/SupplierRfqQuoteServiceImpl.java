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
import com.agribridge.backend.entity.enums.RfqTypeEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.CurrentUserService;
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
    private static final String STATUS_SUBMITTED = "SUBMITTED";
    private static final String STATUS_UPDATED = "UPDATED";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String TERMINAL_QUOTE_MESSAGE = "Không thể sửa báo giá đã được chấp nhận hoặc từ chối.";

    private final QuoteRepository quoteRepository;
    private final RfqRepository rfqRepository;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final BatchAvailabilityService batchAvailabilityService;
    private final CurrentUserService currentUserService;

    @Override
    @Transactional(readOnly = true)
    public SupplierQuoteContextDto getQuoteContext(Long rfqId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        RfqEntity rfq = rfqRepository.findById(rfqId)
                .orElseThrow(() -> new IllegalArgumentException("RFQ does not exist"));
        validateSupplierCanRespond(supplierCompanyId, rfq);
        ProductEntity product = rfq.getProductId() == null
                ? null
                : productRepository.findById(rfq.getProductId()).orElse(null);
        String unit = rfq.getUnit() == null || rfq.getUnit().isBlank()
                ? (product == null ? null : product.getUnit())
                : rfq.getUnit();
        List<Long> quoteProductIds = quoteProductIds(supplierCompanyId, rfq);
        List<SupplierQuoteContextDto.BatchContextDto> batches = quoteProductIds.isEmpty()
                ? List.of()
                : batchRepository.findByProductIdInOrderByCreatedAtDesc(quoteProductIds)
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
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        if (request.supplierCompanyId() != null && !supplierCompanyId.equals(request.supplierCompanyId())) {
            throw new IllegalArgumentException("Supplier cannot quote for another company");
        }
        log.info("Create/update supplier quote rfqId={} supplierCompanyId={}", rfqId, supplierCompanyId);
        QuoteEntity existingQuote = quoteRepository
                .findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(supplierCompanyId, rfqId)
                .orElse(null);
        ensureQuoteCanStillChange(existingQuote);

        RfqEntity rfq = validateRfq(rfqId);
        validateSupplierCanRespond(supplierCompanyId, rfq);

        QuoteEntity quote = existingQuote == null ? new QuoteEntity() : existingQuote;

        quote.setRfqId(rfqId);
        quote.setSupplierCompanyId(supplierCompanyId);
        quote.setBatchId(validateSelectedBatch(request.batchId(), rfq, supplierCompanyId, request.quantity()));
        quote.setPrice(request.price());
        quote.setQuantity(request.quantity());
        quote.setDeliveryDays(request.deliveryDays());
        quote.setNote(normalizeNote(request.note()));
        quote.setStatus(existingQuote == null ? STATUS_SUBMITTED : STATUS_UPDATED);
        if (quote.getCreatedAt() == null) {
            quote.setCreatedAt(LocalDateTime.now());
        }
        quoteRepository.save(quote);
        if (RfqStatusEnum.OPEN.equals(rfq.getStatus())) {
            rfq.setStatus(RfqStatusEnum.QUOTED);
            rfq.setUpdatedAt(LocalDateTime.now());
            rfqRepository.save(rfq);
        }
    }

    private Long validateSelectedBatch(Long batchId, RfqEntity rfq, Long supplierCompanyId, BigDecimal quoteQuantity) {
        if (batchId == null) {
            return null;
        }

        BatchEntity batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Selected batch does not exist"));
        ProductEntity batchProduct = productRepository.findById(batch.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Selected batch product does not exist"));
        if (!supplierCompanyId.equals(batchProduct.getSupplierCompanyId())) {
            throw new IllegalArgumentException("Selected batch does not belong to this supplier");
        }
        if (!productMatchesRfq(batchProduct, rfq)) {
            throw new IllegalArgumentException("Selected batch does not match this RFQ");
        }
        batchAvailabilityService.validateOrderable(batch, batch.getProductId(), quoteQuantity);
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
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        if (request.supplierCompanyId() != null && !supplierCompanyId.equals(request.supplierCompanyId())) {
            throw new IllegalArgumentException("Supplier cannot reject for another company");
        }
        log.info("Reject supplier rfq rfqId={} supplierCompanyId={}", rfqId, supplierCompanyId);
        QuoteEntity existingQuote = quoteRepository
                .findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(supplierCompanyId, rfqId)
                .orElse(null);
        ensureQuoteCanStillChange(existingQuote);

        RfqEntity rfq = validateRfq(rfqId);
        validateSupplierCanRespond(supplierCompanyId, rfq);

        QuoteEntity quote = existingQuote == null ? new QuoteEntity() : existingQuote;

        quote.setRfqId(rfqId);
        quote.setSupplierCompanyId(supplierCompanyId);
        quote.setPrice(quote.getPrice() == null ? BigDecimal.ZERO : quote.getPrice());
        quote.setQuantity(rfq.getQuantity() == null ? BigDecimal.ZERO : rfq.getQuantity());
        quote.setDeliveryDays(null);
        quote.setNote(normalizeNote(request.note()));
        quote.setStatus(STATUS_REJECTED);
        quote.setCreatedAt(LocalDateTime.now());
        quoteRepository.save(quote);
    }

    private void ensureQuoteCanStillChange(QuoteEntity quote) {
        if (quote == null || quote.getStatus() == null || List.of(STATUS_PENDING, STATUS_SUBMITTED, STATUS_UPDATED, "SENT", "DRAFT").contains(quote.getStatus().toUpperCase(Locale.ROOT))) {
            return;
        }
        throw new IllegalArgumentException(TERMINAL_QUOTE_MESSAGE);
    }

    private RfqEntity validateRfq(Long rfqId) {
        RfqEntity rfq = rfqRepository.findById(rfqId)
                .orElseThrow(() -> new IllegalArgumentException("RFQ does not exist"));
        if (!RfqStatusEnum.OPEN.equals(rfq.getStatus()) && !RfqStatusEnum.QUOTED.equals(rfq.getStatus())) {
            throw new IllegalArgumentException("RFQ is not open");
        }
        if (rfq.getExpiredAt() != null && !rfq.getExpiredAt().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("RFQ has expired");
        }
        return rfq;
    }

    private void validateSupplierCanRespond(Long supplierCompanyId, RfqEntity rfq) {
        if (rfq.getBuyerCompanyId() != null && rfq.getBuyerCompanyId().equals(supplierCompanyId)) {
            throw new IllegalArgumentException("Supplier cannot quote own RFQ");
        }
        CompanyEntity supplier = companyRepository.findById(supplierCompanyId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier company does not exist"));

        RfqTypeEnum type = rfq.getType() == null ? RfqTypeEnum.MARKETPLACE : rfq.getType();
        if (type == RfqTypeEnum.DIRECT) {
            if (!supplierCompanyId.equals(rfq.getSupplierCompanyId())) {
                throw new IllegalArgumentException("Supplier is not eligible to respond to this direct RFQ");
            }
            return;
        }

        List<ProductEntity> products = productRepository.findBySupplierCompanyId(supplierCompanyId);
        boolean matchesProduct = rfq.getProductId() != null
                && products.stream().anyMatch(product -> rfq.getProductId().equals(product.getId()));
        boolean matchesCategory = rfq.getCategoryId() != null
                && products.stream().anyMatch(product -> rfq.getCategoryId().equals(product.getCategoryId()));
        String requestedProductName = normalizeKeyword(firstText(rfq.getProductName(), rfq.getTitle()));
        boolean matchesKeyword = requestedProductName != null
                && products.stream()
                        .map(ProductEntity::getName)
                        .map(this::normalizeKeyword)
                        .anyMatch(name -> name != null && (name.contains(requestedProductName) || requestedProductName.contains(name)));
        boolean matchesProvince = normalizeKeyword(rfq.getProvince()) != null
                && products.stream().map(ProductEntity::getOriginProvince).map(this::normalizeKeyword)
                        .anyMatch(province -> province != null && province.equals(normalizeKeyword(rfq.getProvince())));

        if (!matchesProvince) {
            String supplierProvince = normalizeKeyword(supplier.getProvince());
            matchesProvince = supplierProvince != null && supplierProvince.equals(normalizeKeyword(rfq.getProvince()));
        }

        if (!matchesProduct && !matchesCategory && !matchesKeyword && !matchesProvince) {
            throw new IllegalArgumentException("Supplier is not eligible to respond to this RFQ");
        }
    }

    private List<Long> quoteProductIds(Long supplierCompanyId, RfqEntity rfq) {
        List<ProductEntity> products = productRepository.findBySupplierCompanyId(supplierCompanyId);
        return products.stream()
                .filter(product -> productMatchesRfq(product, rfq))
                .map(ProductEntity::getId)
                .toList();
    }

    private boolean productMatchesRfq(ProductEntity product, RfqEntity rfq) {
        if (product == null || rfq == null) {
            return false;
        }
        if (rfq.getProductId() != null && rfq.getProductId().equals(product.getId())) {
            return true;
        }
        if (rfq.getCategoryId() != null && rfq.getCategoryId().equals(product.getCategoryId())) {
            return true;
        }
        String requestedProductName = normalizeKeyword(firstText(rfq.getProductName(), rfq.getTitle()));
        String supplierProductName = normalizeKeyword(product.getName());
        return requestedProductName != null
                && supplierProductName != null
                && (supplierProductName.contains(requestedProductName) || requestedProductName.contains(supplierProductName));
    }

    private String firstText(String first, String fallback) {
        String normalized = normalizeNote(first);
        return normalized == null ? normalizeNote(fallback) : normalized;
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
