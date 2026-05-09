package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerQuoteCompareItemResponse;
import com.agribridge.backend.dto.BuyerRfqCompareResponse;
import com.agribridge.backend.dto.BuyerRfqDetailResponse;
import com.agribridge.backend.dto.BuyerRfqListItemResponse;
import com.agribridge.backend.dto.ConvertQuoteToOrderRequest;
import com.agribridge.backend.dto.ConvertQuoteToOrderResponse;
import com.agribridge.backend.dto.CreateBuyerRfqRequest;
import com.agribridge.backend.dto.UpdateBuyerRfqRequest;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.entity.enums.RfqTypeEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.BuyerRfqService;
import com.agribridge.backend.service.CurrentUserService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerRfqServiceImpl implements BuyerRfqService {

    private static final String RFQ_NOT_FOUND = "RFQ_NOT_FOUND";
    private static final String QUOTE_NOT_FOUND = "QUOTE_NOT_FOUND";
    private static final String RFQ_EXPIRED = "RFQ_EXPIRED";
    private static final String RFQ_ALREADY_CONVERTED = "RFQ_ALREADY_CONVERTED";
    private static final String QUOTE_NOT_AVAILABLE = "QUOTE_NOT_AVAILABLE";
    private static final String BRANCH_NOT_BELONG_TO_BUYER = "BRANCH_NOT_BELONG_TO_BUYER";
    private static final String QUOTE_ACCEPTED = "ACCEPTED";
    private static final String QUOTE_REJECTED = "REJECTED";
    private static final String QUOTE_CANCELLED = "CANCELLED";
    private static final String TYPE_DIRECT = "DIRECT";
    private static final String TYPE_MARKETPLACE = "MARKETPLACE";
    private static final Set<String> TERMINAL_QUOTES = Set.of(QUOTE_ACCEPTED, QUOTE_REJECTED, QUOTE_CANCELLED);
    private static final DateTimeFormatter INVOICE_TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final RfqRepository rfqRepository;
    private final QuoteRepository quoteRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InvoiceRepository invoiceRepository;
    private final BatchRepository batchRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;
    private final CurrentUserService currentUserService;
    private final BatchAvailabilityService batchAvailabilityService;

    @Override
    @Transactional(readOnly = true)
    public Page<BuyerRfqListItemResponse> getRfqs(String status, String keyword, int page, int size) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqStatusEnum parsedStatus = parseStatus(status);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.max(Math.min(size, 100), 1));
        Page<RfqEntity> rfqs = rfqRepository.findByBuyerCompanyIdForBuyerPage(
                buyerCompanyId,
                parsedStatus,
                normalizeText(keyword),
                pageable);
        Map<Long, Long> quoteCounts = quoteCounts(rfqs.getContent().stream().map(RfqEntity::getId).toList());
        return rfqs.map(rfq -> toListItem(rfq, quoteCounts.getOrDefault(rfq.getId(), 0L)));
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerRfqDetailResponse getRfq(Long rfqId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqEntity rfq = findBuyerRfq(buyerCompanyId, rfqId);
        return toDetail(rfq, quoteRepository.countByRfqId(rfqId));
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerRfqCompareResponse compareQuotes(Long rfqId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqEntity rfq = findBuyerRfq(buyerCompanyId, rfqId);
        BranchEntity branch = loadBranch(rfq.getBranchId()).orElse(null);
        List<QuoteEntity> quotes = quoteRepository.findByRfqIdOrderByCreatedAtDesc(rfqId);
        Map<Long, CompanyEntity> suppliers = companyMap(quotes.stream().map(QuoteEntity::getSupplierCompanyId).toList());
        Map<Long, BatchEntity> batches = batchMap(quotes.stream().map(QuoteEntity::getBatchId).filter(Objects::nonNull).toList());
        Map<Long, Long> supplierOrderCounts = supplierOrderCounts(suppliers.keySet());
        BigDecimal minPrice = quotes.stream()
                .map(QuoteEntity::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
        Integer minDeliveryDays = quotes.stream()
                .map(QuoteEntity::getDeliveryDays)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);

        return new BuyerRfqCompareResponse(
                new BuyerRfqCompareResponse.RfqCompareSummary(
                        rfq.getId(),
                        rfqCode(rfq.getId()),
                        rfq.getTitle(),
                        rfqType(rfq).name(),
                        productName(rfq),
                        productName(rfq),
                        rfq.getQuantity(),
                        rfq.getUnit(),
                        null,
                        rfq.getExpiredAt(),
                        rfq.getDeliveryDate(),
                        rfq.getProvince(),
                        deliveryAddress(branch)),
                quotes.stream()
                        .map(quote -> toCompareItem(
                                quote,
                                suppliers.get(quote.getSupplierCompanyId()),
                                batches.get(quote.getBatchId()),
                                supplierOrderCounts.getOrDefault(quote.getSupplierCompanyId(), 0L),
                                minPrice,
                                minDeliveryDays,
                                rfq))
                        .toList());
    }

    @Override
    @Transactional
    public BuyerRfqDetailResponse createRfq(CreateBuyerRfqRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqTypeEnum type = parseType(request.type(), RfqTypeEnum.MARKETPLACE);
        if (request.expiredAt() == null || !request.expiredAt().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("expiredAt must be greater than now");
        }
        ProductEntity product = request.productId() == null
                ? null
                : productRepository.findById(request.productId())
                        .orElseThrow(() -> new IllegalArgumentException("PRODUCT_NOT_FOUND"));
        Long categoryId = request.categoryId() != null
                ? request.categoryId()
                : (product == null ? null : product.getCategoryId());
        if (categoryId != null && !categoryRepository.existsById(categoryId)) {
            throw new IllegalArgumentException("CATEGORY_NOT_FOUND");
        }
        if (type == RfqTypeEnum.MARKETPLACE && categoryId == null && normalizeText(request.productName()) == null && normalizeText(request.title()) == null) {
            throw new IllegalArgumentException("categoryId or productName is required");
        }
        Long supplierCompanyId = firstNonNull(request.supplierCompanyId(), request.supplierId());
        if (type == RfqTypeEnum.DIRECT) {
            if (product == null) {
                throw new IllegalArgumentException("productId is required for direct RFQ");
            }
            supplierCompanyId = product.getSupplierCompanyId();
            if (supplierCompanyId == null) {
                throw new IllegalArgumentException("SUPPLIER_NOT_FOUND");
            }
        } else {
            supplierCompanyId = null;
        }
        BranchEntity branch = validateBranchForBuyer(request.branchId(), buyerCompanyId).orElse(null);
        String productName = firstText(request.productName(), product == null ? request.title() : product.getName());
        LocalDateTime now = LocalDateTime.now();

        RfqEntity rfq = rfqRepository.save(RfqEntity.builder()
                .buyerCompanyId(buyerCompanyId)
                .type(type)
                .supplierCompanyId(supplierCompanyId)
                .branchId(branch == null ? null : branch.getId())
                .productId(product == null ? null : product.getId())
                .categoryId(categoryId)
                .title(normalizeRequired(request.title(), "title is required"))
                .productName(productName)
                .description(normalizeText(request.description()))
                .quantity(request.quantity())
                .unit(normalizeRequired(request.unit(), "unit is required"))
                .deliveryDate(request.deliveryDate())
                .province(firstText(request.province(), branch == null ? null : branch.getProvince()))
                .expiredAt(request.expiredAt())
                .status(RfqStatusEnum.OPEN)
                .createdAt(now)
                .updatedAt(now)
                .build());
        return toDetail(rfq, 0);
    }

    @Override
    @Transactional
    public BuyerRfqDetailResponse updateRfq(Long rfqId, UpdateBuyerRfqRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqEntity rfq = findBuyerRfq(buyerCompanyId, rfqId);
        if (RfqStatusEnum.CLOSED.equals(rfq.getStatus()) || RfqStatusEnum.ACCEPTED.equals(rfq.getStatus())) {
            throw new IllegalArgumentException(RFQ_ALREADY_CONVERTED);
        }
        if (RfqStatusEnum.CANCELLED.equals(rfq.getStatus())) {
            throw new IllegalArgumentException("RFQ_CANCELLED");
        }
        boolean hasAcceptedQuote = quoteRepository.findByRfqIdOrderByCreatedAtDesc(rfqId).stream()
                .anyMatch(quote -> QUOTE_ACCEPTED.equalsIgnoreCase(quote.getStatus()));
        if (hasAcceptedQuote) {
            throw new IllegalArgumentException(RFQ_ALREADY_CONVERTED);
        }
        if (request.title() != null) {
            rfq.setTitle(normalizeRequired(request.title(), "title is required"));
        }
        if (request.quantity() != null) {
            if (request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("quantity must be greater than 0");
            }
            rfq.setQuantity(request.quantity());
        }
        if (request.deliveryDate() != null) {
            rfq.setDeliveryDate(request.deliveryDate());
        }
        if (request.expiredAt() != null) {
            if (!request.expiredAt().isAfter(LocalDateTime.now())) {
                throw new IllegalArgumentException("expiredAt must be greater than now");
            }
            rfq.setExpiredAt(request.expiredAt());
        }
        if (request.province() != null) {
            rfq.setProvince(normalizeText(request.province()));
        }
        if (request.description() != null) {
            rfq.setDescription(normalizeText(request.description()));
        }
        if (request.branchId() != null) {
            BranchEntity branch = validateBranchForBuyer(request.branchId(), buyerCompanyId)
                    .orElseThrow(() -> new IllegalArgumentException(BRANCH_NOT_BELONG_TO_BUYER));
            rfq.setBranchId(branch.getId());
        }
        rfq.setUpdatedAt(LocalDateTime.now());
        return toDetail(rfqRepository.save(rfq), quoteRepository.countByRfqId(rfqId));
    }

    @Override
    @Transactional
    public void cancelRfq(Long rfqId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqEntity rfq = findBuyerRfq(buyerCompanyId, rfqId);
        if (RfqStatusEnum.CLOSED.equals(rfq.getStatus()) || RfqStatusEnum.ACCEPTED.equals(rfq.getStatus()) || hasOrderForRfq(rfqId)) {
            throw new IllegalArgumentException(RFQ_ALREADY_CONVERTED);
        }
        rfq.setStatus(RfqStatusEnum.CANCELLED);
        rfq.setUpdatedAt(LocalDateTime.now());
        rfqRepository.save(rfq);
        quoteRepository.updateStatusesByRfqId(rfqId, List.of("PENDING", "SENT", "SUBMITTED", "UPDATED"), QUOTE_CANCELLED);
    }

    @Override
    @Transactional
    public ConvertQuoteToOrderResponse convertQuoteToOrder(
            Long rfqId,
            Long quoteId,
            ConvertQuoteToOrderRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        RfqEntity rfq = findBuyerRfq(buyerCompanyId, rfqId);
        if (RfqStatusEnum.CLOSED.equals(rfq.getStatus()) || RfqStatusEnum.ACCEPTED.equals(rfq.getStatus()) || hasOrderForRfq(rfqId)) {
            throw new IllegalArgumentException(RFQ_ALREADY_CONVERTED);
        }
        if (rfq.getExpiredAt() != null && !rfq.getExpiredAt().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException(RFQ_EXPIRED);
        }
        QuoteEntity quote = quoteRepository.findByIdAndRfqId(quoteId, rfqId)
                .orElseThrow(() -> new IllegalArgumentException(QUOTE_NOT_FOUND));
        if (isQuoteUnavailable(quote)) {
            throw new IllegalArgumentException(QUOTE_NOT_AVAILABLE);
        }
        if (quote.getBatchId() == null) {
            throw new IllegalArgumentException(QUOTE_NOT_AVAILABLE + ": batch_id is required");
        }
        BatchEntity batch = batchRepository.findByIdForUpdate(quote.getBatchId())
                .orElseThrow(() -> new IllegalArgumentException(QUOTE_NOT_AVAILABLE + ": batch not found"));
        if (rfq.getProductId() != null && !Objects.equals(rfq.getProductId(), batch.getProductId())) {
            throw new IllegalArgumentException(QUOTE_NOT_AVAILABLE + ": batch does not match RFQ product");
        }
        CompanyEntity supplier = companyRepository.findById(quote.getSupplierCompanyId()).orElse(null);
        if (!batchAvailabilityService.isSupplierApproved(supplier)) {
            throw new IllegalArgumentException(BatchAvailabilityService.UNAVAILABLE_MESSAGE);
        }
        batchAvailabilityService.validateOrderable(batch, batch.getProductId(), quote.getQuantity());
        if (orderRepository.existsByQuoteId(quoteId)) {
            throw new IllegalArgumentException(RFQ_ALREADY_CONVERTED);
        }

        LocalDateTime now = LocalDateTime.now();
        BigDecimal totalAmount = safeAmount(quote.getPrice()).multiply(safeAmount(quote.getQuantity()));
        BranchEntity branch = loadBranch(rfq.getBranchId()).orElse(null);
        String deliveryAddress = firstText(request == null ? null : request.deliveryAddress(), deliveryAddress(branch));
        String deliveryProvince = firstText(request == null ? null : request.deliveryProvince(), rfq.getProvince());

        OrderEntity order = orderRepository.save(OrderEntity.builder()
                .buyerCompanyId(buyerCompanyId)
                .supplierCompanyId(quote.getSupplierCompanyId())
                .branchId(rfq.getBranchId())
                .quoteId(quote.getId())
                .status(OrderStatusEnum.PENDING)
                .subtotal(totalAmount)
                .shippingFee(BigDecimal.ZERO)
                .totalAmount(totalAmount)
                .deliveryAddress(deliveryAddress)
                .deliveryProvince(deliveryProvince)
                .note(firstText(request == null ? null : request.note(), "Created from RFQ #" + rfq.getId()))
                .createdAt(now)
                .build());

        orderItemRepository.save(OrderItemEntity.builder()
                .orderId(order.getId())
                .batchId(batch.getId())
                .productId(batch.getProductId())
                .price(quote.getPrice())
                .quantity(quote.getQuantity())
                .unit(rfq.getUnit())
                .subtotal(totalAmount)
                .build());

        BigDecimal remainingQuantity = safeAmount(batch.getQuantity()).subtract(safeAmount(quote.getQuantity()));
        batch.setQuantity(remainingQuantity.compareTo(BigDecimal.ZERO) <= 0 ? BigDecimal.ZERO : remainingQuantity);
        if (batch.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            batch.setStatus(com.agribridge.backend.entity.enums.BatchStatusEnum.SOLD_OUT);
        }
        batchRepository.save(batch);

        InvoiceEntity invoice = null;
        if (request == null || !Boolean.FALSE.equals(request.createInvoice())) {
            invoice = invoiceRepository.save(InvoiceEntity.builder()
                    .orderId(order.getId())
                    .invoiceNumber(generateInvoiceNumber(order.getId(), now))
                    .buyerCompanyId(order.getBuyerCompanyId())
                    .supplierCompanyId(order.getSupplierCompanyId())
                    .subtotal(totalAmount)
                    .shippingFee(BigDecimal.ZERO)
                    .totalAmount(totalAmount)
                    .adjustedAmount(totalAmount)
                    .dueDate(LocalDate.now().plusDays(7))
                    .status(InvoiceStatusEnum.UNPAID)
                    .createdAt(now)
                    .build());
        }

        quote.setStatus(QUOTE_ACCEPTED);
        quoteRepository.save(quote);
        quoteRepository.updateOtherQuotesStatus(rfqId, quoteId, QUOTE_REJECTED, TERMINAL_QUOTES);
        rfq.setStatus(RfqStatusEnum.ACCEPTED);
        rfq.setUpdatedAt(now);
        rfqRepository.save(rfq);

        return new ConvertQuoteToOrderResponse(
                order.getId(),
                invoice == null ? null : invoice.getId(),
                quote.getId(),
                rfq.getId(),
                totalAmount,
                order.getStatus().name(),
                invoice == null ? null : invoice.getStatus().name());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConvertQuoteToOrderResponse> getRfqOrders(Long rfqId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        findBuyerRfq(buyerCompanyId, rfqId);
        List<Long> quoteIds = quoteRepository.findByRfqIdOrderByCreatedAtDesc(rfqId).stream()
                .map(QuoteEntity::getId)
                .toList();
        if (quoteIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findByQuoteIdIn(quoteIds).stream()
                .map(order -> {
                    InvoiceEntity invoice = invoiceRepository.findTopByOrderIdOrderByCreatedAtDesc(order.getId()).orElse(null);
                    return new ConvertQuoteToOrderResponse(
                            order.getId(),
                            invoice == null ? null : invoice.getId(),
                            order.getQuoteId(),
                            rfqId,
                            order.getTotalAmount(),
                            order.getStatus() == null ? null : order.getStatus().name(),
                            invoice == null || invoice.getStatus() == null ? null : invoice.getStatus().name());
                })
                .toList();
    }

    private BuyerRfqListItemResponse toListItem(RfqEntity rfq, long quoteCount) {
        CompanyEntity supplier = loadCompany(rfq.getSupplierCompanyId()).orElse(null);
        String resolvedProductName = productName(rfq);
        return new BuyerRfqListItemResponse(
                rfq.getId(),
                rfqCode(rfq.getId()),
                rfq.getTitle(),
                rfqType(rfq).name(),
                rfq.getStatus() == null ? null : rfq.getStatus().name(),
                quoteCount,
                rfq.getCreatedAt(),
                rfq.getExpiredAt(),
                resolvedProductName,
                resolvedProductName,
                rfq.getProductId(),
                rfq.getSupplierCompanyId(),
                supplier == null ? null : supplier.getName(),
                rfq.getCategoryId(),
                rfq.getQuantity(),
                rfq.getUnit(),
                null,
                rfq.getDeliveryDate(),
                rfq.getProvince(),
                rfq.getBranchId());
    }

    private BuyerRfqDetailResponse toDetail(RfqEntity rfq, long quoteCount) {
        BranchEntity branch = loadBranch(rfq.getBranchId()).orElse(null);
        CategoryEntity category = rfq.getCategoryId() == null
                ? null
                : categoryRepository.findById(rfq.getCategoryId()).orElse(null);
        CompanyEntity supplier = loadCompany(rfq.getSupplierCompanyId()).orElse(null);
        String resolvedProductName = productName(rfq);
        return new BuyerRfqDetailResponse(
                rfq.getId(),
                rfqCode(rfq.getId()),
                rfq.getTitle(),
                rfq.getDescription(),
                rfqType(rfq).name(),
                rfq.getStatus() == null ? null : rfq.getStatus().name(),
                quoteCount,
                rfq.getCreatedAt(),
                rfq.getExpiredAt(),
                rfq.getProductId(),
                resolvedProductName,
                resolvedProductName,
                rfq.getSupplierCompanyId(),
                supplier == null ? null : supplier.getName(),
                rfq.getCategoryId(),
                category == null ? null : category.getName(),
                rfq.getQuantity(),
                rfq.getUnit(),
                null,
                rfq.getDeliveryDate(),
                rfq.getProvince(),
                branch == null ? null : new BuyerRfqDetailResponse.BranchSummary(
                        branch.getId(),
                        branch.getName(),
                        branch.getAddress(),
                        branch.getDeliveryAddress(),
                        branch.getProvince(),
                        branch.getPhone()));
    }

    private BuyerQuoteCompareItemResponse toCompareItem(
            QuoteEntity quote,
            CompanyEntity supplier,
            BatchEntity batch,
            long supplierOrderCount,
            BigDecimal minPrice,
            Integer minDeliveryDays,
            RfqEntity rfq) {
        List<String> tags = new ArrayList<>();
        if (minPrice != null && quote.getPrice() != null && quote.getPrice().compareTo(minPrice) == 0) {
            tags.add("Giá tốt nhất");
        }
        if (minDeliveryDays != null && Objects.equals(quote.getDeliveryDays(), minDeliveryDays)) {
            tags.add("Giao nhanh");
        }
        if (isVerifiedSupplier(supplier)) {
            tags.add("Đã xác minh");
        }
        LocalDate estimatedDeliveryDate = quote.getDeliveryDays() == null
                ? null
                : LocalDate.now().plusDays(quote.getDeliveryDays());
        return new BuyerQuoteCompareItemResponse(
                quote.getId(),
                quote.getSupplierCompanyId(),
                supplier == null ? null : supplier.getName(),
                supplier == null ? null : supplier.getProvince(),
                null,
                supplierOrderCount,
                tags,
                quote.getPrice(),
                quote.getQuantity(),
                safeAmount(quote.getPrice()).multiply(safeAmount(quote.getQuantity())),
                quote.getBatchId(),
                batch == null ? null : batchCode(batch.getId()),
                gradeSize(batch),
                batch == null ? null : batch.getHarvestDate(),
                quote.getDeliveryDays(),
                estimatedDeliveryDate,
                null,
                quote.getNote(),
                quote.getNote(),
                quote.getStatus());
    }

    private RfqEntity findBuyerRfq(Long buyerCompanyId, Long rfqId) {
        return rfqRepository.findByIdAndBuyerCompanyId(rfqId, buyerCompanyId)
                .orElseThrow(() -> new IllegalArgumentException(RFQ_NOT_FOUND));
    }

    private Optional<BranchEntity> validateBranchForBuyer(Long branchId, Long buyerCompanyId) {
        if (branchId == null) {
            return Optional.empty();
        }
        return Optional.of(branchRepository.findByIdAndCompanyId(branchId, buyerCompanyId)
                .filter(branch -> Boolean.TRUE.equals(branch.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException(BRANCH_NOT_BELONG_TO_BUYER)));
    }

    private boolean hasOrderForRfq(Long rfqId) {
        List<Long> quoteIds = quoteRepository.findByRfqIdOrderByCreatedAtDesc(rfqId).stream()
                .map(QuoteEntity::getId)
                .toList();
        return !quoteIds.isEmpty() && !orderRepository.findByQuoteIdIn(quoteIds).isEmpty();
    }

    private Map<Long, Long> quoteCounts(Collection<Long> rfqIds) {
        if (rfqIds == null || rfqIds.isEmpty()) {
            return Map.of();
        }
        return quoteRepository.findByRfqIdIn(rfqIds).stream()
                .collect(Collectors.groupingBy(QuoteEntity::getRfqId, LinkedHashMap::new, Collectors.counting()));
    }

    private Map<Long, CompanyEntity> companyMap(Collection<Long> companyIds) {
        List<Long> ids = companyIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return companyRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(CompanyEntity::getId, Function.identity(), (left, right) -> left));
    }

    private Map<Long, BatchEntity> batchMap(Collection<Long> batchIds) {
        List<Long> ids = batchIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return batchRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(BatchEntity::getId, Function.identity(), (left, right) -> left));
    }

    private Map<Long, Long> supplierOrderCounts(Collection<Long> supplierIds) {
        Map<Long, Long> result = new LinkedHashMap<>();
        supplierIds.stream().filter(Objects::nonNull).forEach(supplierId ->
                result.put(supplierId, (long) orderRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(supplierId).size()));
        return result;
    }

    private Optional<BranchEntity> loadBranch(Long branchId) {
        return branchId == null ? Optional.empty() : branchRepository.findById(branchId);
    }

    private Optional<CompanyEntity> loadCompany(Long companyId) {
        return companyId == null ? Optional.empty() : companyRepository.findById(companyId);
    }

    private RfqStatusEnum parseStatus(String rawStatus) {
        String value = normalizeText(rawStatus);
        if (value == null) {
            return null;
        }
        try {
            return RfqStatusEnum.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid RFQ status");
        }
    }

    private RfqTypeEnum parseType(String rawType, RfqTypeEnum fallback) {
        String value = normalizeText(rawType);
        if (value == null) {
            return fallback;
        }
        try {
            return RfqTypeEnum.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid RFQ type");
        }
    }

    private RfqTypeEnum rfqType(RfqEntity rfq) {
        return rfq == null || rfq.getType() == null ? RfqTypeEnum.MARKETPLACE : rfq.getType();
    }

    private boolean isQuoteUnavailable(QuoteEntity quote) {
        String status = quote.getStatus() == null ? null : quote.getStatus().trim().toUpperCase(Locale.ROOT);
        return status == null || QUOTE_REJECTED.equals(status) || QUOTE_CANCELLED.equals(status) || QUOTE_ACCEPTED.equals(status);
    }

    private boolean isVerifiedSupplier(CompanyEntity supplier) {
        return supplier != null && (Boolean.TRUE.equals(supplier.getVerifiedStatus())
                || VerificationStatusEnum.APPROVED.equals(supplier.getVerificationStatus()));
    }

    private String productName(RfqEntity rfq) {
        String stored = normalizeText(rfq.getProductName());
        if (stored != null) {
            return stored;
        }
        ProductEntity product = rfq.getProduct();
        if (product != null) {
            return product.getName();
        }
        return rfq.getProductId() == null
                ? rfq.getTitle()
                : productRepository.findById(rfq.getProductId()).map(ProductEntity::getName).orElse(null);
    }

    private String deliveryAddress(BranchEntity branch) {
        return branch == null ? null : firstText(branch.getDeliveryAddress(), branch.getAddress());
    }

    private String gradeSize(BatchEntity batch) {
        if (batch == null) {
            return null;
        }
        String grade = normalizeText(batch.getGrade());
        String size = normalizeText(batch.getSize());
        if (grade == null) {
            return size;
        }
        if (size == null) {
            return grade;
        }
        return grade + " / " + size;
    }

    private BigDecimal safeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String rfqCode(Long id) {
        return "RFQ-" + String.format("%06d", id == null ? 0L : id);
    }

    private String batchCode(Long id) {
        return "LOT-" + String.format("%06d", id == null ? 0L : id);
    }

    private String generateInvoiceNumber(Long orderId, LocalDateTime now) {
        return "INV-" + now.format(INVOICE_TS) + "-" + orderId;
    }

    private String firstText(String first, String fallback) {
        String normalized = normalizeText(first);
        return normalized == null ? normalizeText(fallback) : normalized;
    }

    private Long firstNonNull(Long first, Long fallback) {
        return first == null ? fallback : first;
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
