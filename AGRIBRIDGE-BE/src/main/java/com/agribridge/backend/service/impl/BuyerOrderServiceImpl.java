package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerOrderDto;
import com.agribridge.backend.dto.BuyerQuickOrderRequestDto;
import com.agribridge.backend.dto.BuyerQuickOrderResponseDto;
import com.agribridge.backend.dto.CreateBuyerComplaintRequestDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.ComplaintEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CreditLimitEntity;
import com.agribridge.backend.entity.EscrowTransactionEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.MomoPaymentAttemptEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.PaymentAllocationEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.ComplaintStatusEnum;
import com.agribridge.backend.entity.enums.CreditLimitStatusEnum;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.CreditLimitRepository;
import com.agribridge.backend.repository.EscrowTransactionRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.MomoPaymentAttemptRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentAllocationRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.BuyerOrderService;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.NotificationCenterService;
import com.agribridge.backend.service.ShipmentStatusTransitionService;
import com.agribridge.backend.service.WalletService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
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
public class BuyerOrderServiceImpl implements BuyerOrderService {
    private static final String COMPLAINT_SOURCE_ORDER_COMPLAINT = "ORDER_COMPLAINT";

    private static final String SENDER_ADDRESS_SOURCE_SUPPLIER = "SUPPLIER_ADDRESS";
    private static final String SHIPPING_FEE_SOURCE_QUOTE = "SUPPLIER_TO_BUYER_QUOTE";
    private static final String QUOTE_ACCEPTED = "ACCEPTED";
    private static final String QUOTE_REJECTED = "REJECTED";
    private static final String QUOTE_CANCELLED = "CANCELLED";

    private static final BigDecimal SUBTOTAL_TOLERANCE = new BigDecimal("1.00");
    private static final DateTimeFormatter INVOICE_TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter DISPLAY_TIME = new DateTimeFormatterBuilder()
            .appendPattern("dd/MM HH:mm")
            .toFormatter();

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final RfqRepository rfqRepository;
    private final QuoteRepository quoteRepository;
    private final CompanyRepository companyRepository;
    private final CreditLimitRepository creditLimitRepository;
    private final BranchRepository branchRepository;
    private final ComplaintRepository complaintRepository;
    private final EscrowTransactionRepository escrowTransactionRepository;
    private final MomoPaymentAttemptRepository momoPaymentAttemptRepository;
    private final CurrentUserService currentUserService;
    private final BatchAvailabilityService batchAvailabilityService;
    private final NotificationCenterService notificationCenterService;
    private final ShipmentStatusTransitionService shipmentStatusTransitionService;
    private final WalletService walletService;

    @Override
    @Transactional
    public List<BuyerOrderDto> getCurrentBuyerOrders() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        List<OrderEntity> orders = orderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(buyerCompanyId);
        return mapOrders(orders);
    }

    @Override
    @Transactional
    public BuyerOrderDto getCurrentBuyerOrder(Long orderId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this buyer");
        }
        return mapOrders(List.of(order)).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    @Override
    @Transactional
    public BuyerQuickOrderResponseDto createQuickOrder(BuyerQuickOrderRequestDto request) {
        validateRequest(request);

        PaymentMethod paymentMethod = parsePaymentMethod(firstText(request.paymentOption(), request.paymentMethod()));
        CompanyEntity buyer = currentUserService.requireCurrentBuyerCompany();
        if (request.buyerCompanyId() != null && !buyer.getId().equals(request.buyerCompanyId())) {
            throw new IllegalArgumentException("Buyer company does not match current user");
        }
        CompanyEntity supplier = request.supplierId() == null ? null
                : companyRepository.findById(request.supplierId())
                        .orElseThrow(() -> new IllegalArgumentException("Supplier company not found"));
        if (request.branchId() != null) {
            branchRepository.findByIdAndCompanyId(request.branchId(), buyer.getId())
                    .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                    .orElseThrow(
                            () -> new IllegalArgumentException("Branch is inactive or does not belong to this buyer"));
        }
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (supplier == null) {
            supplier = companyRepository.findById(product.getSupplierCompanyId())
                    .orElseThrow(() -> new IllegalArgumentException("Supplier company not found"));
        }
        if (buyer.getId().equals(supplier.getId())) {
            throw new IllegalArgumentException("Supplier cannot buy from itself");
        }
        BatchEntity batch = batchRepository.findByIdForUpdate(request.batchId())
                .orElseThrow(() -> new IllegalArgumentException("Batch not found"));

        if (!Objects.equals(product.getSupplierCompanyId(), supplier.getId())) {
            throw new IllegalArgumentException("Product does not belong to this supplier");
        }
        if (!batchAvailabilityService.isSupplierApproved(supplier)) {
            throw new IllegalArgumentException(BatchAvailabilityService.UNAVAILABLE_MESSAGE);
        }
        batchAvailabilityService.validateOrderable(batch, product.getId(), request.quantity());
        QuoteEntity rfqQuote = validateRfqQuoteForQuickOrder(request, buyer.getId(), supplier.getId(), product.getId(), batch.getId());

        BigDecimal unitPrice = request.unitPrice() == null ? batch.getPrice() : request.unitPrice();
        BigDecimal subtotal = request.quantity().multiply(unitPrice);
        BigDecimal shippingFee = positiveOrZero(request.shippingFee());
        BigDecimal grandTotal = subtotal.add(shippingFee);
        LocalDateTime now = LocalDateTime.now();
        LocalDate creditDueDate = paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                ? validateCreditLimit(supplier.getId(), buyer.getId(), grandTotal)
                : null;
        LocalDateTime expectedDeliveryDate = now.plusDays(demoDeliveryDays(buyer));
        BigDecimal depositAmount = paymentMethod == PaymentMethod.DEPOSIT_50
                ? grandTotal.multiply(new BigDecimal("0.50"))
                : null;
        BigDecimal remainingAmount = paymentMethod == PaymentMethod.DEPOSIT_50 ? grandTotal.subtract(depositAmount)
                : BigDecimal.ZERO;

        OrderEntity order = orderRepository.save(OrderEntity.builder()
                .buyerCompanyId(buyer.getId())
                .supplierCompanyId(supplier.getId())
                .branchId(request.branchId())
                .quoteId(rfqQuote == null ? null : rfqQuote.getId())
                .status(orderInitialStatus(paymentMethod))
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .totalAmount(grandTotal)
                .paymentMethod(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? "CREDIT"
                        : "BANK_TRANSFER_DEMO")
                .paymentOption(paymentMethod.name())
                .paymentStatus(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? "CREDIT_OPEN"
                        : "WAITING_TRANSFER")
                .escrowStatus(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? null
                        : "NOT_FUNDED")
                .depositRate(paymentMethod == PaymentMethod.DEPOSIT_50 ? new BigDecimal("50") : null)
                .depositAmount(depositAmount)
                .balanceAmount(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? grandTotal
                        : remainingAmount)
                .remainingAmount(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? grandTotal
                        : remainingAmount)
                .deliveryName(firstText(request.deliveryName(), firstText(buyer.getOwnerName(), buyer.getName())))
                .deliveryPhone(firstText(request.deliveryPhone(), buyer.getPhone()))
                .deliveryProvince(firstText(request.deliveryProvince(), buyer.getProvince()))
                .deliveryDistrict(firstText(request.deliveryDistrict(), buyer.getDistrict()))
                .deliveryWard(firstText(request.deliveryWard(), buyer.getWard()))
                .deliveryAddress(firstText(request.deliveryAddress(), buyer.getAddress()))
                .shippingAddressSnapshot(addressSnapshot(request, buyer))
                .expectedDeliveryDate(expectedDeliveryDate)
                .note(trim(request.note()))
                .createdAt(now)
                .updatedAt(now)
                .build());

        orderItemRepository.save(OrderItemEntity.builder()
                .orderId(order.getId())
                .batchId(batch.getId())
                .productId(product.getId())
                .quantity(request.quantity())
                .unit(firstText(request.unit(), product.getUnit()))
                .price(unitPrice)
                .subtotal(subtotal)
                .build());
        BigDecimal remainingQuantity = batch.getQuantity().subtract(request.quantity());
        batch.setQuantity(remainingQuantity);
        if (remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            batch.setQuantity(BigDecimal.ZERO);
            batch.setStatus(BatchStatusEnum.SOLD_OUT);
        }
        batchRepository.save(batch);

        InvoiceEntity invoice = invoiceRepository.save(InvoiceEntity.builder()
                .orderId(order.getId())
                .invoiceNumber(generateInvoiceNumber(order.getId(), now))
                .buyerCompanyId(buyer.getId())
                .supplierCompanyId(supplier.getId())
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .totalAmount(grandTotal)
                .adjustedAmount(grandTotal)
                .paymentMethod(paymentMethod.name())
                .depositRate(paymentMethod == PaymentMethod.DEPOSIT_50 ? new BigDecimal("50") : null)
                .depositAmount(depositAmount)
                .balanceAmount(paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT
                        ? grandTotal
                        : remainingAmount)
                .dueDate(creditDueDate)
                .status(InvoiceStatusEnum.UNPAID)
                .createdAt(now)
                .build());

        PaymentEntity payment = paymentRepository
                .save(buildInitialPayment(invoice, order, paymentMethod, grandTotal, depositAmount, creditDueDate, now));
        ShipmentEntity shipment = null;
        if (request.shippingProviderCode() != null && !request.shippingProviderCode().isBlank()) {
            shipment = shipmentRepository.save(buildInitialShipment(order, request, shippingFee, now));
        }
        if (shipment != null) {
            shipmentEventRepository.save(ShipmentEventEntity.builder()
                    .shipmentId(shipment.getId())
                    .status(shipment.getStatus().name())
                    .description(
                            "Đã lưu thông tin vận chuyển dự kiến. GHN sandbox chỉ báo phí")
                    .eventTime(now)
                    .build());

        }
        notificationCenterService.notifySupplierOrderCreated(order, buyer.getName());
        acceptRfqQuoteIfPresent(request, rfqQuote, order);
        return new BuyerQuickOrderResponseDto(
                order.getId(),
                orderCode(order.getId()),
                invoice.getId(),
                null,
                payment.getId(),
                null,
                order.getStatus().name(),
                invoice.getStatus().name(),
                payment.getStatus(),
                order.getEscrowStatus(),
                payment.getTransferContent(),
                payment.getAmount(),
                order.getDepositAmount(),
                order.getRemainingAmount(),
                null,
                grandTotal,
                "Tạo đơn hàng thành công");
    }

    @Override
    @Transactional
    public BuyerOrderDto demoConfirmPayment(Long orderId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        OrderEntity order = requireBuyerOrder(buyerCompanyId, orderId);
        if (!OrderStatusEnum.PENDING_PAYMENT.equals(order.getStatus())
                && !OrderStatusEnum.PENDING_DEPOSIT.equals(order.getStatus())) {
            throw new IllegalArgumentException("Order is not waiting for initial payment");
        }
        PaymentEntity payment = paymentRepository.findByOrderIdOrderByPaymentDateDesc(orderId).stream()
                .filter(item -> "FULL".equals(item.getPaymentType()) || "DEPOSIT".equals(item.getPaymentType()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        LocalDateTime now = LocalDateTime.now();
        boolean deposit = "DEPOSIT_50".equals(order.getPaymentOption());
        payment.setPaidAmount(payment.getAmount());
        payment.setStatus(deposit ? "PARTIALLY_PAID" : "PAID");
        payment.setEscrowStatus(deposit ? "PARTIALLY_HELD" : "HELD");
        payment.setPaidAt(now);
        payment.setVerifiedAt(now);
        payment.setUpdatedAt(now);
        paymentRepository.save(payment);
        createPaymentAllocationIfMissing(payment, payment.getAmount(), now);
        order.setStatus(OrderStatusEnum.SUPPLIER_CONFIRMED);
        order.setPaymentStatus(deposit ? "PARTIALLY_PAID" : "PAID");
        order.setEscrowStatus(deposit ? "PARTIALLY_HELD" : "HELD");
        order.setUpdatedAt(now);
        orderRepository.save(order);
        createEscrowHold(order, payment, payment.getAmount(),
                deposit ? "Platform holds buyer deposit" : "Platform holds full payment from buyer", now);
        markLatestInvoiceStatus(orderId, deposit ? InvoiceStatusEnum.PARTIAL : InvoiceStatusEnum.PAID);
        String buyerName = companyRepository.findById(order.getBuyerCompanyId()).map(CompanyEntity::getName).orElse("Buyer");
        if (deposit) {
            notificationCenterService.notifySupplierDepositPaid(order, payment.getAmount(), buyerName);
        } else {
            notificationCenterService.notifySupplierRemainingPaid(order, latestInvoice(orderId), payment.getAmount(), buyerName);
            notificationCenterService.notifyBuyerPaymentCompleted(order);
        }
        return getCurrentBuyerOrder(orderId);
    }

    @Override
    @Transactional
    public BuyerOrderDto demoPayRemaining(Long orderId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        OrderEntity order = requireBuyerOrder(buyerCompanyId, orderId);
        if (!OrderStatusEnum.WAITING_FINAL_PAYMENT.equals(order.getStatus())) {
            throw new IllegalArgumentException("Order is not waiting for final payment");
        }
        if (paymentRepository.findTopByOrderIdAndPaymentTypeOrderByPaymentDateDesc(orderId, "REMAINING").isPresent()) {
            throw new IllegalArgumentException("Remaining payment already exists");
        }
        InvoiceEntity invoice = latestInvoice(orderId);
        LocalDateTime now = LocalDateTime.now();
        BigDecimal remaining = safeAmount(order.getRemainingAmount());
        PaymentEntity payment = paymentRepository.save(PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .amount(remaining)
                .paidAmount(remaining)
                .paymentMethod("BANK_TRANSFER_DEMO")
                .paymentType("REMAINING")
                .status("PAID")
                .escrowStatus("HELD")
                .transferContent("AGRI-REMAINING-" + order.getId())
                .paymentDate(now)
                .paidAt(now)
                .verifiedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .note("Buyer thanh toán phần còn lại qua demo")
                .build());
        createPaymentAllocationIfMissing(payment, remaining, now);
        order.setPaymentStatus("PAID");
        order.setEscrowStatus("HELD");
        order.setStatus(OrderStatusEnum.WAITING_BUYER_CONFIRM);
        order.setUpdatedAt(now);
        orderRepository.save(order);
        createEscrowHold(order, payment, remaining, "Platform holds remaining payment", now);
        markLatestInvoiceStatus(orderId, InvoiceStatusEnum.PAID);
        String buyerName = companyRepository.findById(order.getBuyerCompanyId()).map(CompanyEntity::getName).orElse("Buyer");
        notificationCenterService.notifySupplierRemainingPaid(order, invoice, remaining, buyerName);
        notificationCenterService.notifyBuyerPaymentCompleted(order);
        return getCurrentBuyerOrder(orderId);
    }

    @Override
    @Transactional
    public void confirmReceived(Long buyerCompanyId, Long orderId) {
        if (buyerCompanyId == null || orderId == null) {
            throw new IllegalArgumentException("Buyer company and order are required");
        }
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this buyer");
        }
        if (!List.of(OrderStatusEnum.WAITING_BUYER_CONFIRM, OrderStatusEnum.WAITING_FINAL_PAYMENT, OrderStatusEnum.DELIVERED).contains(order.getStatus())) {
            throw new IllegalArgumentException("Order is not waiting for buyer confirmation");
        }

        ShipmentEntity shipment = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));
        if (!ShipmentStatusEnum.WAITING_CONFIRMATION.equals(shipment.getStatus())) {
            throw new IllegalArgumentException("Shipment is not waiting for buyer confirmation");
        }

        shipmentStatusTransitionService.buyerConfirmReceived(
                shipment,
                currentUserService.requireCurrentUser().getId(),
                "Người mua xác nhận đã nhận hàng");
        InvoiceEntity invoice = latestInvoice(orderId);
        BigDecimal paid = paidAmountForInvoice(invoice.getId(), paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoice.getId()));
        BigDecimal remaining = safeAmount(invoice.getAdjustedAmount()).subtract(paid).max(BigDecimal.ZERO);
        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            LocalDate dueDate = invoice.getDueDate() == null ? LocalDate.now() : invoice.getDueDate();
            invoice.setDueDate(dueDate);
            invoice.setStatus(InvoiceStatusEnum.PARTIAL);
            invoiceRepository.save(invoice);
            order.setStatus(OrderStatusEnum.WAITING_FINAL_PAYMENT);
            order.setPaymentStatus("PARTIALLY_PAID");
            order.setRemainingAmount(remaining);
            order.setUpdatedAt(LocalDateTime.now());
            orderRepository.save(order);
            notificationCenterService.notifyBuyerPaymentRemainingRequired(order, invoice, remaining, dueDate);
            return;
        }
        releaseEscrowAndComplete(order);
    }

    @Override
    @Transactional
    public void confirmReceived(Long orderId) {
        confirmReceived(currentUserService.requireCurrentBuyerCompanyId(), orderId);
    }

    @Override
    @Transactional
    public BuyerOrderDto.ComplaintDto createComplaint(Long orderId, CreateBuyerComplaintRequestDto request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        Long currentUserId = currentUserService.requireCurrentUser().getId();
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this buyer");
        }
        if (request.batchId() != null) {
            boolean batchBelongsToOrder = orderItemRepository.findByOrderIdOrderByIdAsc(orderId).stream()
                    .anyMatch(item -> request.batchId().equals(item.getBatchId()));
            if (!batchBelongsToOrder) {
                throw new IllegalArgumentException("Batch does not belong to this order");
            }
        }

        ComplaintEntity complaint = complaintRepository.save(ComplaintEntity.builder()
                .orderId(orderId)
                .batchId(request.batchId())
                .sourceType(COMPLAINT_SOURCE_ORDER_COMPLAINT)
                .createdByUserId(currentUserId)
                .title(trim(request.title()))
                .description(trim(request.description()))
                .status(ComplaintStatusEnum.OPEN)
                .severity(firstText(request.severity(), "MEDIUM"))
                .createdAt(LocalDateTime.now())
                .build());
        markOrderDisputed(order);
        String buyerName = companyRepository.findById(order.getBuyerCompanyId()).map(CompanyEntity::getName).orElse("Buyer");
        notificationCenterService.notifySupplierComplaintCreated(order, complaint.getId(), buyerName);
        return mapComplaint(complaint);
    }

    private void markOrderDisputed(OrderEntity order) {
        if (order == null || order.getStatus() == OrderStatusEnum.CANCELLED || order.getStatus() == OrderStatusEnum.REFUNDED) {
            return;
        }
        order.setStatus(OrderStatusEnum.DISPUTED);
        order.setEscrowStatus(firstText(order.getEscrowStatus(), "HELD"));
        order.setUpdatedAt(LocalDateTime.now());
        orderRepository.save(order);
    }

    private List<BuyerOrderDto> mapOrders(List<OrderEntity> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }

        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        Map<Long, List<OrderItemEntity>> itemsByOrder = orderItemRepository.findByOrderIdIn(orderIds).stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId));
        Map<Long, InvoiceEntity> invoiceByOrder = latestByOrder(
                invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds), InvoiceEntity::getOrderId,
                InvoiceEntity::getCreatedAt);
        Map<Long, List<PaymentEntity>> paymentsByOrder = orderIds.isEmpty()
                ? Map.of()
                : paymentRepository.findByOrderIdInOrderByPaymentDateDesc(orderIds).stream()
                        .collect(Collectors.groupingBy(PaymentEntity::getOrderId));
        reconcilePaymentState(orders, invoiceByOrder, paymentsByOrder);
        Map<Long, ShipmentEntity> shipmentByOrder = latestByOrder(
                shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds), ShipmentEntity::getOrderId,
                ShipmentEntity::getCreatedAt);
        Map<Long, List<ComplaintEntity>> complaintsByOrder = complaintRepository
                .findByOrderIdInOrderByCreatedAtDesc(orderIds).stream()
                .collect(Collectors.groupingBy(ComplaintEntity::getOrderId));
        Map<Long, BranchEntity> branchesById = branchRepository.findByIdIn(
                orders.stream().map(OrderEntity::getBranchId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(BranchEntity::getId, Function.identity()));
        Map<Long, CompanyEntity> companiesById = companyRepository.findAllById(
                orders.stream()
                        .flatMap(order -> List.of(order.getSupplierCompanyId(), order.getBuyerCompanyId()).stream())
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));

        List<OrderItemEntity> allItems = itemsByOrder.values().stream().flatMap(Collection::stream).toList();
        Map<Long, ProductEntity> productsById = productRepository.findAllById(
                allItems.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, BatchEntity> batchesById = batchRepository.findAllById(
                allItems.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(BatchEntity::getId, Function.identity()));

        Map<Long, List<BuyerOrderDto.TrackingEventDto>> trackingByShipment = new HashMap<>();
        for (ShipmentEntity shipment : shipmentByOrder.values()) {
            trackingByShipment.put(shipment.getId(),
                    shipmentEventRepository.findByShipmentIdOrderByEventTimeAsc(shipment.getId()).stream()
                            .map(event -> new BuyerOrderDto.TrackingEventDto(
                                    firstText(event.getDescription(), event.getStatus()),
                                    formatDateTime(event.getEventTime()),
                                    true,
                                    event.getStatus(),
                                    event.getLocation()))
                            .toList());
        }

        return orders.stream()
                .map(order -> mapOrder(
                        order,
                        itemsByOrder.getOrDefault(order.getId(), List.of()),
                        invoiceByOrder.get(order.getId()),
                        shipmentByOrder.get(order.getId()),
                        trackingByShipment,
                        paymentsByOrder,
                        complaintsByOrder.getOrDefault(order.getId(), List.of()),
                        branchesById,
                        companiesById,
                        productsById,
                        batchesById))
                .toList();
    }

    private void reconcilePaymentState(
            List<OrderEntity> orders,
            Map<Long, InvoiceEntity> invoiceByOrder,
            Map<Long, List<PaymentEntity>> paymentsByOrder) {
        if (orders.isEmpty()) return;
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        Map<Long, List<MomoPaymentAttemptEntity>> attemptsByPayment = momoPaymentAttemptRepository.findByOrderIdIn(orderIds).stream()
                .collect(Collectors.groupingBy(MomoPaymentAttemptEntity::getPaymentId));
        LocalDateTime now = LocalDateTime.now();
        for (OrderEntity order : orders) {
            List<PaymentEntity> payments = paymentsByOrder.getOrDefault(order.getId(), List.of());
            if (payments.isEmpty()) continue;
            boolean changed = false;
            for (PaymentEntity payment : payments) {
                if (isPaymentSettled(payment, attemptsByPayment.getOrDefault(payment.getId(), List.of()))) {
                    BigDecimal amount = safeAmount(payment.getAmount());
                    if (safeAmount(payment.getPaidAmount()).compareTo(amount) < 0) {
                        payment.setPaidAmount(amount);
                        changed = true;
                    }
                    if (!isPaidPayment(payment)) {
                        payment.setStatus("PAID");
                        changed = true;
                    }
                    if (!"HELD".equals(payment.getEscrowStatus())) {
                        payment.setEscrowStatus("HELD");
                        changed = true;
                    }
                    if (payment.getPaidAt() == null) {
                        payment.setPaidAt(now);
                        changed = true;
                    }
                    if (payment.getVerifiedAt() == null) {
                        payment.setVerifiedAt(now);
                        changed = true;
                    }
                    payment.setUpdatedAt(now);
                }
            }
            if (changed) {
                paymentRepository.saveAll(payments);
            }

            InvoiceEntity invoice = invoiceByOrder.get(order.getId());
            BigDecimal paid = payments.stream()
                    .filter(this::isPaidPayment)
                    .map(payment -> safeAmount(payment.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0
                            ? payment.getPaidAmount()
                            : payment.getAmount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal total = invoice == null ? safeAmount(order.getTotalAmount())
                    : safeAmount(invoice.getAdjustedAmount()).compareTo(BigDecimal.ZERO) > 0
                    ? invoice.getAdjustedAmount()
                    : invoice.getTotalAmount();
            if (paid.compareTo(BigDecimal.ZERO) <= 0) continue;
            boolean fullyPaid = paid.compareTo(safeAmount(total)) >= 0;
            boolean depositOnly = !fullyPaid && "DEPOSIT_50".equalsIgnoreCase(order.getPaymentOption());

            if (invoice != null) {
                InvoiceStatusEnum nextInvoiceStatus = fullyPaid ? InvoiceStatusEnum.PAID : InvoiceStatusEnum.PARTIAL;
                if (invoice.getStatus() != nextInvoiceStatus) {
                    invoice.setStatus(nextInvoiceStatus);
                    invoiceRepository.save(invoice);
                }
            }
            String nextPaymentStatus = fullyPaid ? "PAID" : "PARTIALLY_PAID";
            boolean orderChanged = false;
            if (!nextPaymentStatus.equals(order.getPaymentStatus())) {
                order.setPaymentStatus(nextPaymentStatus);
                orderChanged = true;
            }
            if (!"HELD".equals(order.getEscrowStatus())) {
                order.setEscrowStatus("HELD");
                orderChanged = true;
            }
            OrderStatusEnum nextStatus = null;
            if (order.getStatus() == OrderStatusEnum.PENDING_PAYMENT
                    || order.getStatus() == OrderStatusEnum.PENDING_DEPOSIT
                    || order.getStatus() == OrderStatusEnum.PENDING
                    || order.getStatus() == OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION) {
                nextStatus = depositOnly
                        ? OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM
                        : OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM;
            }
            if (nextStatus != null && order.getStatus() != nextStatus) {
                order.setStatus(nextStatus);
                orderChanged = true;
            }
            if (fullyPaid && safeAmount(order.getRemainingAmount()).compareTo(BigDecimal.ZERO) > 0) {
                order.setRemainingAmount(BigDecimal.ZERO);
                orderChanged = true;
            }
            if (orderChanged) {
                order.setUpdatedAt(now);
                orderRepository.save(order);
            }
        }
    }

    private boolean isPaymentSettled(PaymentEntity payment, List<MomoPaymentAttemptEntity> attempts) {
        if (isPaidPayment(payment)) return true;
        BigDecimal amount = safeAmount(payment.getAmount());
        if (amount.compareTo(BigDecimal.ZERO) > 0 && safeAmount(payment.getPaidAmount()).compareTo(amount) >= 0) return true;
        return attempts.stream().anyMatch(attempt -> "PAID".equalsIgnoreCase(attempt.getStatus()));
    }

    private boolean isPaidPayment(PaymentEntity payment) {
        if (payment == null) return false;
        String status = payment.getStatus() == null ? "" : payment.getStatus().trim().toUpperCase(Locale.ROOT);
        if (List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(status)) return true;
        BigDecimal amount = safeAmount(payment.getAmount());
        return amount.compareTo(BigDecimal.ZERO) > 0 && safeAmount(payment.getPaidAmount()).compareTo(amount) >= 0;
    }

    private BuyerOrderDto mapOrder(
            OrderEntity order,
            List<OrderItemEntity> items,
            InvoiceEntity invoice,
            ShipmentEntity shipment,
            Map<Long, List<BuyerOrderDto.TrackingEventDto>> trackingByShipment,
            Map<Long, List<PaymentEntity>> paymentsByOrder,
            List<ComplaintEntity> complaints,
            Map<Long, BranchEntity> branchesById,
            Map<Long, CompanyEntity> companiesById,
            Map<Long, ProductEntity> productsById,
            Map<Long, BatchEntity> batchesById) {
        List<BuyerOrderDto.ItemDto> itemDtos = items.stream()
                .map(item -> mapItem(item, productsById.get(item.getProductId()), batchesById.get(item.getBatchId())))
                .toList();
        List<PaymentEntity> payments = paymentsByOrder.getOrDefault(order.getId(), List.of());
        BigDecimal paidAmount = payments.stream()
                .map(payment -> payment.getPaidAmount() == null ? BigDecimal.ZERO : payment.getPaidAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BranchEntity branch = branchesById.get(order.getBranchId());
        CompanyEntity supplier = companiesById.get(order.getSupplierCompanyId());
        List<BuyerOrderDto.TrackingEventDto> trackingEvents = shipment == null
                ? List.of(new BuyerOrderDto.TrackingEventDto("Order created", formatDateTime(order.getCreatedAt()),
                        true, normalizeBuyerVisibleStatus(order.getStatus()).name(), null))
                : trackingByShipment.getOrDefault(shipment.getId(), List.of());
        if (trackingEvents.isEmpty()) {
            trackingEvents = List.of(new BuyerOrderDto.TrackingEventDto("Shipment created",
                    formatDateTime(shipment.getCreatedAt()), true, shipment.getStatus().name(), null));
        }

        BigDecimal resolvedShippingFee = resolveShippingFee(order, shipment);
        BigDecimal resolvedTotalAmount = safeAmount(order.getSubtotal()).add(resolvedShippingFee);
        return new BuyerOrderDto(
                orderCode(order.getId()),
                order.getId(),
                supplier == null ? "N/A" : supplier.getName(),
                order.getSupplierCompanyId(),
                order.getBuyerCompanyId(),
                branchName(order, branch),
                order.getBranchId(),
                order.getQuoteId(),
                order.getQuoteId() == null ? null : "RFQ-" + order.getQuoteId(),
                normalizeBuyerVisibleStatus(order.getStatus()).name(),
                summarizeProduct(itemDtos),
                summarizeQuantity(itemDtos),
                itemDtos,
                safeAmount(order.getSubtotal()),
                resolvedShippingFee,
                resolvedTotalAmount,
                formatMoney(resolvedTotalAmount),
                order.getPaymentMethod(),
                order.getPaymentOption(),
                order.getPaymentStatus(),
                order.getEscrowStatus(),
                order.getDepositRate(),
                order.getDepositAmount(),
                order.getBalanceAmount(),
                order.getRemainingAmount(),
                order.getDeliveryName(),
                order.getDeliveryPhone(),
                order.getDeliveryProvince(),
                order.getDeliveryDistrict(),
                order.getDeliveryWard(),
                order.getDeliveryAddress(),
                shipment == null ? null : shipment.getProviderCode(),
                shipment == null ? null : firstText(shipment.getProviderName(), shipment.getCarrierName()),
                shipment == null ? null : firstText(shipment.getServiceName(), shipment.getShippingMethod()),
                shipment == null ? null : shipment.getShippingPayer(),
                shipment == null ? null
                        : firstText(shipment.getEstimatedDeliveryTime(),
                                shipment.getExpectedDeliveryDate() == null ? null
                                        : formatDateTime(shipment.getExpectedDeliveryDate())),
                order.getExpectedDeliveryDate(),
                mapShipment(shipment),
                trackingEvents,
                shipment == null ? null : shipment.getDriverName(),
                shipment == null ? null : shipment.getDriverPhone(),
                shipment == null ? null : shipment.getVehicleInfo(),
                shipment == null ? null : shipment.getTrackingCode(),
                invoice == null ? null : invoice.getInvoiceNumber(),
                paidAmount,
                invoice == null ? null : invoice.getDueDate(),
                invoice == null || invoice.getStatus() == null ? null : invoice.getStatus().name(),
                payments.stream().map(this::mapPayment).toList(),
                complaints.stream().map(this::mapComplaint).toList(),
                order.getNote(),
                order.getCreatedAt());
    }

    private BuyerOrderDto.ItemDto mapItem(OrderItemEntity item, ProductEntity product, BatchEntity batch) {
        return new BuyerOrderDto.ItemDto(
                item.getBatchId(),
                batch == null ? "LOT-" + item.getBatchId() : firstText(batch.getQrCode(), "LOT-" + batch.getId()),
                item.getProductId(),
                product == null ? "N/A" : product.getName(),
                batch == null ? null : batch.getGrade(),
                batch == null ? null : batch.getSize(),
                batch == null ? null : batch.getHarvestDate(),
                item.getQuantity(),
                firstText(item.getUnit(), product == null ? null : product.getUnit()),
                item.getPrice(),
                safeAmount(item.getSubtotal()));
    }

    private OrderStatusEnum normalizeBuyerVisibleStatus(OrderStatusEnum status) {
        if (status == OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM
                || status == OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM) {
            return OrderStatusEnum.SUPPLIER_CONFIRMED;
        }
        return status == null ? OrderStatusEnum.PENDING : status;
    }

    private BuyerOrderDto.PaymentDto mapPayment(PaymentEntity payment) {
        return new BuyerOrderDto.PaymentDto(
                payment.getId(),
                payment.getAmount(),
                payment.getPaidAmount(),
                payment.getPaymentMethod(),
                payment.getPaymentType(),
                payment.getStatus(),
                payment.getEscrowStatus(),
                payment.getTransferContent(),
                payment.getDueDate(),
                payment.getPaymentDate(),
                payment.getPaidAt(),
                payment.getVerifiedAt(),
                payment.getNote());
    }

    private BuyerOrderDto.ShipmentDto mapShipment(ShipmentEntity shipment) {
        if (shipment == null) {
            return null;
        }
        return new BuyerOrderDto.ShipmentDto(
                shipment.getId(),
                firstText(shipment.getProviderName(), firstText(shipment.getCarrierName(), shipment.getProviderCode())),
                shipment.getTrackingCode(),
                shipment.getStatus() == null ? null : shipment.getStatus().name(),
                shipment.getReceiverName(),
                shipment.getReceiverPhone(),
                shipment.getReceiverAddress(),
                shipment.getExpectedDeliveryDate(),
                shipment.getShippingFee(),
                shipment.getDeliveredAt());
    }

    private BuyerOrderDto.ComplaintDto mapComplaint(ComplaintEntity complaint) {
        return new BuyerOrderDto.ComplaintDto(
                complaint.getId(),
                complaint.getBatchId(),
                complaint.getTitle(),
                complaint.getDescription(),
                complaint.getStatus() == null ? null : complaint.getStatus().name(),
                complaint.getSeverity(),
                complaint.getResolution(),
                complaint.getCreatedAt(),
                complaint.getResolvedAt());
    }

    private <T> Map<Long, T> latestByOrder(List<T> values, Function<T, Long> orderId,
            Function<T, LocalDateTime> createdAt) {
        return values.stream().collect(Collectors.toMap(
                orderId,
                Function.identity(),
                (left, right) -> Comparator.nullsLast(LocalDateTime::compareTo).compare(createdAt.apply(left),
                        createdAt.apply(right)) >= 0 ? left : right));
    }

    private void validateRequest(BuyerQuickOrderRequestDto request) {
        if (request.productId() == null) {
            throw new IllegalArgumentException("productId is required");
        }
        if (request.batchId() == null) {
            throw new IllegalArgumentException("batchId is required");
        }
        if (request.quantity() == null || request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("quantity must be greater than 0");
        }
        if (request.unitPrice() != null && request.unitPrice().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("unitPrice must be greater than or equal to 0");
        }
        if (request.subtotal() != null && request.subtotal().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("subtotal must be greater than or equal to 0");
        }
        BigDecimal expectedSubtotal = request.unitPrice() == null || request.subtotal() == null
                ? null
                : request.quantity().multiply(request.unitPrice());
        if (expectedSubtotal != null
                && expectedSubtotal.subtract(request.subtotal()).abs().compareTo(SUBTOTAL_TOLERANCE) > 0) {
            throw new IllegalArgumentException("subtotal does not match quantity * unitPrice");
        }
        parsePaymentMethod(firstText(request.paymentOption(), request.paymentMethod()));
    }

    private LocalDate validateCreditLimit(Long supplierCompanyId, Long buyerCompanyId, BigDecimal grandTotal) {
        CreditLimitEntity creditLimit = creditLimitRepository
                .findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId, buyerCompanyId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Credit limit is not configured for this buyer and supplier"));
        if (CreditLimitStatusEnum.CLOSED.equals(creditLimit.getStatus()) || safeAmount(creditLimit.getCreditLimit()).compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Nhà cung cấp hiện không hỗ trợ thanh toán công nợ.");
        }
        if (Boolean.TRUE.equals(creditLimit.getIsBlocked()) || CreditLimitStatusEnum.SUSPENDED.equals(creditLimit.getStatus())) {
            throw new IllegalArgumentException(
                    creditLimit.getBlockedReason() == null || creditLimit.getBlockedReason().isBlank()
                            ? "Thanh toán công nợ hiện đang bị tạm khóa bởi nhà cung cấp."
                            : creditLimit.getBlockedReason());
        }
        if (!List.of(7, 15, 30).contains(creditLimit.getPaymentTermDays())) {
            throw new IllegalArgumentException("Credit payment term must be 7, 15 or 30 days");
        }
        if (hasBlockedOverdueInvoice(supplierCompanyId, buyerCompanyId)) {
            throw new IllegalArgumentException("Buyer has overdue invoices and cannot use credit payment");
        }
        BigDecimal outstanding = calculateOutstandingCredit(supplierCompanyId, buyerCompanyId);
        BigDecimal remaining = safeAmount(creditLimit.getCreditLimit()).subtract(outstanding);
        if (grandTotal.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Không đủ hạn mức công nợ.");
        }
        return LocalDate.now().plusDays(creditLimit.getPaymentTermDays());
    }

    private boolean hasBlockedOverdueInvoice(Long supplierCompanyId, Long buyerCompanyId) {
        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId,
                buyerCompanyId);
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        if (orderIds.isEmpty()) return false;
        List<InvoiceEntity> invoices = invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of()
                : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        LocalDate today = LocalDate.now();
        return invoices.stream()
                .filter(this::isCreditInvoice)
                .filter(invoice -> invoice.getDueDate() != null && invoice.getDueDate().isBefore(today))
                .filter(invoice -> invoice.getStatus() != InvoiceStatusEnum.PAID
                        && invoice.getStatus() != InvoiceStatusEnum.CANCELLED
                        && invoice.getStatus() != InvoiceStatusEnum.VOIDED)
                .anyMatch(invoice -> safeAmount(invoice.getAdjustedAmount())
                        .subtract(paidAmountForInvoice(invoice.getId(), payments))
                        .compareTo(BigDecimal.ZERO) > 0);
    }

    private BigDecimal calculateOutstandingCredit(Long supplierCompanyId, Long buyerCompanyId) {
        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId,
                buyerCompanyId);
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        if (orderIds.isEmpty()) {
            return BigDecimal.ZERO;
        }
        List<InvoiceEntity> invoices = invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of()
                : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        return invoices.stream()
                .filter(this::isCreditInvoice)
                .filter(invoice -> invoice.getStatus() != InvoiceStatusEnum.PAID)
                .map(invoice -> safeAmount(invoice.getAdjustedAmount())
                        .subtract(paidAmountForInvoice(invoice.getId(), payments)))
                .filter(amount -> amount.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean isCreditInvoice(InvoiceEntity invoice) {
        String method = firstText(invoice == null ? null : invoice.getPaymentMethod(), "");
        return "CREDIT".equalsIgnoreCase(method) || "DEBT".equalsIgnoreCase(method);
    }

    private BigDecimal paidAmountForInvoice(Long invoiceId, List<PaymentEntity> payments) {
        return payments.stream()
                .filter(payment -> Objects.equals(invoiceId, payment.getInvoiceId()))
                .filter(payment -> payment.getStatus() != null && List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(payment.getStatus().trim().toUpperCase(Locale.ROOT)))
                .map(payment -> payment.getPaidAmount() == null ? safeAmount(payment.getAmount())
                        : safeAmount(payment.getPaidAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private OrderEntity requireBuyerOrder(Long buyerCompanyId, Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this buyer");
        }
        return order;
    }

    private InvoiceEntity latestInvoice(Long orderId) {
        return invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(List.of(orderId)).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Invoice not found"));
    }

    private void markLatestInvoiceStatus(Long orderId, InvoiceStatusEnum status) {
        InvoiceEntity invoice = latestInvoice(orderId);
        invoice.setStatus(status);
        invoiceRepository.save(invoice);
    }

    private void createPaymentAllocationIfMissing(PaymentEntity payment, BigDecimal amount, LocalDateTime now) {
        if (payment == null || payment.getId() == null || payment.getInvoiceId() == null) return;
        boolean hasAllocation = !paymentAllocationRepository.findByPaymentIdIn(List.of(payment.getId())).isEmpty();
        if (hasAllocation) return;
        paymentAllocationRepository.save(PaymentAllocationEntity.builder()
                .paymentId(payment.getId())
                .invoiceId(payment.getInvoiceId())
                .amount(safeAmount(amount))
                .createdAt(now)
                .build());
    }

    private void createEscrowHold(OrderEntity order, PaymentEntity payment, BigDecimal amount, String description,
            LocalDateTime now) {
        escrowTransactionRepository.save(EscrowTransactionEntity.builder()
                .orderId(order.getId())
                .paymentId(payment.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .supplierCompanyId(order.getSupplierCompanyId())
                .amount(amount)
                .transactionType("HOLD")
                .status("SUCCESS")
                .description(description)
                .createdAt(now)
                .build());
    }

    private void releaseEscrowAndComplete(OrderEntity order) {
        if ("RELEASED".equals(order.getEscrowStatus())
                || escrowTransactionRepository.existsByOrderIdAndTransactionTypeAndStatus(order.getId(), "RELEASE",
                        "SUCCESS")) {
            throw new IllegalArgumentException("Escrow already released");
        }
        LocalDateTime now = LocalDateTime.now();
        ShipmentEntity shipment = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(order.getId()).orElse(null);
        if (shipment != null) {
            shipment.setConfirmedReceivedAt(now);
            shipment.setConfirmedReceivedByUserId(currentUserService.requireCurrentUser().getId());
            shipment.setUpdatedAt(now);
            shipmentRepository.save(shipment);
        }
        BigDecimal heldAmount = paymentRepository.findByOrderIdOrderByPaymentDateDesc(order.getId()).stream()
                .map(payment -> safeAmount(payment.getPaidAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setStatus(OrderStatusEnum.COMPLETED);
        order.setEscrowStatus("RELEASED");
        order.setCompletedAt(now);
        order.setUpdatedAt(now);
        orderRepository.save(order);
        escrowTransactionRepository.save(EscrowTransactionEntity.builder()
                .orderId(order.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .supplierCompanyId(order.getSupplierCompanyId())
                .amount(heldAmount)
                .transactionType("RELEASE")
                .status("SUCCESS")
                .description("Platform releases payment to supplier")
                .createdAt(now)
                .build());
        walletService.releaseEscrowToSupplier(order, heldAmount, now);
    }

    private PaymentEntity buildInitialPayment(
            InvoiceEntity invoice,
            OrderEntity order,
            PaymentMethod paymentMethod,
            BigDecimal grandTotal,
            BigDecimal depositAmount,
            LocalDate creditDueDate,
            LocalDateTime now) {
        boolean credit = paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT;
        BigDecimal amount = paymentMethod == PaymentMethod.DEPOSIT_50 ? depositAmount : grandTotal;
        String paymentType = credit ? "CREDIT" : paymentMethod == PaymentMethod.DEPOSIT_50 ? "DEPOSIT" : "FULL";
        String transferContent = (paymentMethod == PaymentMethod.DEPOSIT_50 ? "AGRI-DEPOSIT-" : "AGRI-ORDER-")
                + order.getId();
        return PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .amount(amount)
                .paidAmount(BigDecimal.ZERO)
                .paymentMethod(credit ? "CREDIT" : "BANK_TRANSFER_DEMO")
                .paymentType(paymentType)
                .status(credit ? "UNPAID" : "WAITING_TRANSFER")
                .escrowStatus(credit ? null : "NOT_FUNDED")
                .dueDate(credit ? creditDueDate : null)
                .transferContent(transferContent)
                .paymentDate(now)
                .createdAt(now)
                .updatedAt(now)
                .note(credit
                        ? "Buyer chon cong no, khong yeu cau thanh toan ngay"
                        : paymentMethod == PaymentMethod.DEPOSIT_50
                        ? "Buyer chọn đặt cọc 50%, chờ chuyển khoản demo"
                        : "Buyer chọn thanh toán 100% qua sàn, chờ chuyển khoản demo")
                .build();
    }

    private ShipmentEntity buildInitialShipment(
            OrderEntity order,
            BuyerQuickOrderRequestDto request,
            BigDecimal shippingFee,
            LocalDateTime now) {
        String providerName = firstText(request.shippingProviderName(), request.shippingProviderCode());
        return ShipmentEntity.builder()
                .orderId(order.getId())
                .carrierName(providerName)
                .providerCode(trim(request.shippingProviderCode()))
                .providerName(trim(request.shippingProviderName()))
                .serviceName(trim(request.shippingServiceName()))
                .shippingMethod(trim(request.shippingServiceName()))
                .receiverName(trim(request.deliveryName()))
                .receiverPhone(trim(request.deliveryPhone()))
                .receiverProvince(trim(request.deliveryProvince()))
                .receiverDistrict(trim(request.deliveryDistrict()))
                .receiverWard(trim(request.deliveryWard()))
                .receiverAddress(trim(request.deliveryAddress()))
                .quoteStatus(firstText(request.shippingStatus(), "PENDING_QUOTE"))
                .estimatedDeliveryTime(trim(request.estimatedDeliveryTime()))
                .shippingPayer(firstText(request.shippingPayer(), "BUYER"))
                .shippingFee(shippingFee)
                .weight(request.shippingWeight())
                .length(request.shippingLength())
                .width(request.shippingWidth())
                .height(request.shippingHeight())
                .shopIdUsed(trim(request.shippingShopIdUsed()))
                .fromDistrictId(request.shippingFromDistrictId())
                .fromWardCode(trim(request.shippingFromWardCode()))
                .toDistrictId(request.shippingToDistrictId())
                .toWardCode(trim(request.shippingToWardCode()))
                .serviceTypeId(request.shippingServiceTypeId())
                .serviceId(request.shippingServiceId())
                .insuranceValue(request.shippingInsuranceValue())
                .rawQuoteRequest(request.shippingRawQuoteRequest())
                .rawQuoteResponse(request.shippingRawQuoteResponse())
                .quotedShippingFee(shippingFee)
                .senderAddressSource(SENDER_ADDRESS_SOURCE_SUPPLIER)
                .shippingFeeSource(SHIPPING_FEE_SOURCE_QUOTE)
                .feeConfirmed(shippingFee.compareTo(BigDecimal.ZERO) > 0)
                .status(ShipmentStatusEnum.PREPARING)
                .autoProgressEnabled(Boolean.FALSE)
                .demoTrackingEnabled(Boolean.FALSE)
                .progress(20)
                .lastStatusChangedAt(now)
                .incidentNote("Quote only. GHN sandbox fee is stored here; no real waybill has been created.")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private QuoteEntity validateRfqQuoteForQuickOrder(
            BuyerQuickOrderRequestDto request,
            Long buyerCompanyId,
            Long supplierCompanyId,
            Long productId,
            Long batchId) {
        if (request.rfqId() == null && request.quoteId() == null) {
            return null;
        }
        if (request.rfqId() == null || request.quoteId() == null) {
            throw new IllegalArgumentException("rfqId and quoteId must be provided together");
        }
        RfqEntity rfq = rfqRepository.findByIdAndBuyerCompanyId(request.rfqId(), buyerCompanyId)
                .orElseThrow(() -> new IllegalArgumentException("RFQ_NOT_FOUND"));
        if (RfqStatusEnum.CLOSED.equals(rfq.getStatus()) || RfqStatusEnum.ACCEPTED.equals(rfq.getStatus())) {
            throw new IllegalArgumentException("RFQ_ALREADY_CONVERTED");
        }
        if (RfqStatusEnum.CANCELLED.equals(rfq.getStatus())) {
            throw new IllegalArgumentException("RFQ_CANCELLED");
        }
        QuoteEntity quote = quoteRepository.findByIdAndRfqId(request.quoteId(), request.rfqId())
                .orElseThrow(() -> new IllegalArgumentException("QUOTE_NOT_FOUND"));
        String quoteStatus = quote.getStatus() == null ? "" : quote.getStatus().trim().toUpperCase(Locale.ROOT);
        if (QUOTE_ACCEPTED.equals(quoteStatus) || QUOTE_REJECTED.equals(quoteStatus) || QUOTE_CANCELLED.equals(quoteStatus)) {
            throw new IllegalArgumentException("QUOTE_NOT_AVAILABLE");
        }
        if (orderRepository.existsByQuoteId(quote.getId())) {
            throw new IllegalArgumentException("RFQ_ALREADY_CONVERTED");
        }
        if (!Objects.equals(quote.getSupplierCompanyId(), supplierCompanyId)) {
            throw new IllegalArgumentException("QUOTE_SUPPLIER_MISMATCH");
        }
        if (!Objects.equals(quote.getBatchId(), batchId)) {
            throw new IllegalArgumentException("QUOTE_BATCH_MISMATCH");
        }
        if (rfq.getProductId() != null && !Objects.equals(rfq.getProductId(), productId)) {
            throw new IllegalArgumentException("QUOTE_PRODUCT_MISMATCH");
        }
        return quote;
    }

    private void acceptRfqQuoteIfPresent(BuyerQuickOrderRequestDto request, QuoteEntity quote, OrderEntity order) {
        if (quote == null || request.rfqId() == null) {
            return;
        }
        RfqEntity rfq = rfqRepository.findById(request.rfqId())
                .orElseThrow(() -> new IllegalArgumentException("RFQ_NOT_FOUND"));
        quote.setStatus(QUOTE_ACCEPTED);
        quoteRepository.save(quote);
        quoteRepository.updateOtherQuotesStatus(rfq.getId(), quote.getId(), QUOTE_REJECTED, List.of(QUOTE_ACCEPTED, QUOTE_REJECTED, QUOTE_CANCELLED));
        rfq.setStatus(RfqStatusEnum.ACCEPTED);
        rfq.setUpdatedAt(LocalDateTime.now());
        rfqRepository.save(rfq);
        notificationCenterService.notifySupplierQuoteSelected(rfq, quote, order);
    }


    private PaymentMethod parsePaymentMethod(String raw) {
        String normalized = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if ("FULL_PAYMENT".equals(normalized) || "ESCROW_TRANSFER".equals(normalized)) {
            return PaymentMethod.FULL_PAYMENT;
        }
        if ("DEPOSIT_50".equals(normalized)) {
            return PaymentMethod.DEPOSIT_50;
        }
        if ("DEBT".equals(normalized)) {
            return PaymentMethod.DEBT;
        }
        try {
            return PaymentMethod.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("paymentMethod is invalid");
        }
    }

    private OrderStatusEnum orderInitialStatus(PaymentMethod paymentMethod) {
        if (paymentMethod == PaymentMethod.DEPOSIT_50) return OrderStatusEnum.PENDING_DEPOSIT;
        if (paymentMethod == PaymentMethod.CREDIT || paymentMethod == PaymentMethod.DEBT) {
            return OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION;
        }
        return OrderStatusEnum.PENDING_PAYMENT;
    }

    private BigDecimal positiveOrZero(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("shippingFee must be greater than or equal to 0");
        }
        return value;
    }

    private BigDecimal safeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String generateInvoiceNumber(Long orderId, LocalDateTime now) {
        return "INV-" + now.format(INVOICE_TS) + "-" + orderId;
    }

    private String orderCode(Long orderId) {
        return orderId == null ? "ORD-N/A" : "ORD-" + orderId;
    }

    private String branchName(OrderEntity order, BranchEntity branch) {
        if (branch != null) {
            return branch.getName();
        }
        return firstText(order.getDeliveryAddress(), "N/A");
    }

    private String summarizeProduct(List<BuyerOrderDto.ItemDto> items) {
        if (items.isEmpty()) {
            return "N/A";
        }
        String firstName = firstText(items.get(0).productName(), "N/A");
        return items.size() == 1 ? firstName : firstName + " +" + (items.size() - 1);
    }

    private String summarizeQuantity(List<BuyerOrderDto.ItemDto> items) {
        if (items.isEmpty()) {
            return "0";
        }
        return items.stream()
                .map(item -> formatNumber(item.quantity()) + " " + firstText(item.unit(), ""))
                .collect(Collectors.joining(", "));
    }

    private String formatMoney(BigDecimal value) {
        return String.format(Locale.US, "%,.0f", value == null ? BigDecimal.ZERO : value) + "d";
    }

    private String formatNumber(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        BigDecimal normalized = value.stripTrailingZeros();
        return normalized.scale() <= 0 ? normalized.toPlainString() : normalized.toPlainString();
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "" : value.format(DISPLAY_TIME);
    }

    private String firstText(String first, String fallback) {
        String normalized = trim(first);
        return normalized == null ? trim(fallback) : normalized;
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }


    private BigDecimal resolveShippingFee(OrderEntity order, ShipmentEntity shipment) {
        if (shipment == null) {
            return safeAmount(order.getShippingFee());
        }
        String providerCode = trim(shipment.getProviderCode());
        if ("GHN".equalsIgnoreCase(providerCode)) {
            return safeAmount(order.getShippingFee());
        }
        return safeAmount(order.getShippingFee());
    }

    private String addressSnapshot(CompanyEntity buyer) {
        return List.of(buyer.getAddress(), buyer.getWard(), buyer.getProvince()).stream()
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));
    }

    private String addressSnapshot(BuyerQuickOrderRequestDto request, CompanyEntity buyer) {
        return List.of(
                        firstText(request.deliveryAddress(), buyer.getAddress()),
                        firstText(request.deliveryWard(), buyer.getWard()),
                        firstText(request.deliveryDistrict(), buyer.getDistrict()),
                        firstText(request.deliveryProvince(), buyer.getProvince()))
                .stream()
                .map(this::trim)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));
    }

    private int demoDeliveryDays(CompanyEntity buyer) {
        String province = buyer.getProvince() == null ? "" : buyer.getProvince().toLowerCase(Locale.ROOT);
        return province.contains("hồ chí minh") || province.contains("ho chi minh") ? 1 : 2;
    }

    private enum PaymentMethod {
        FULL_PAYMENT,
        ESCROW_TRANSFER,
        DEPOSIT_50,
        CREDIT,
        DEBT
    }
}
