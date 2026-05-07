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
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.SupplierPayoutEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.ComplaintStatusEnum;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.CreditLimitRepository;
import com.agribridge.backend.repository.EscrowTransactionRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.repository.SupplierPayoutRepository;
import com.agribridge.backend.service.BatchAvailabilityService;
import com.agribridge.backend.service.BuyerOrderService;
import com.agribridge.backend.service.CurrentUserService;
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

    private static final BigDecimal SUBTOTAL_TOLERANCE = new BigDecimal("1.00");
    private static final DateTimeFormatter INVOICE_TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter DISPLAY_TIME = new DateTimeFormatterBuilder()
            .appendPattern("dd/MM HH:mm")
            .toFormatter();

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final CompanyRepository companyRepository;
    private final CreditLimitRepository creditLimitRepository;
    private final BranchRepository branchRepository;
    private final ComplaintRepository complaintRepository;
    private final EscrowTransactionRepository escrowTransactionRepository;
    private final SupplierPayoutRepository supplierPayoutRepository;
    private final CurrentUserService currentUserService;
    private final BatchAvailabilityService batchAvailabilityService;

    @Override
    @Transactional(readOnly = true)
    public List<BuyerOrderDto> getCurrentBuyerOrders() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        List<OrderEntity> orders = orderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(buyerCompanyId);
        return mapOrders(orders);
    }

    @Override
    @Transactional(readOnly = true)
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
        CompanyEntity supplier = request.supplierId() == null ? null : companyRepository.findById(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier company not found"));
        if (request.branchId() != null) {
            branchRepository.findByIdAndCompanyId(request.branchId(), buyer.getId())
                    .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                    .orElseThrow(() -> new IllegalArgumentException("Branch is inactive or does not belong to this buyer"));
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

        BigDecimal unitPrice = request.unitPrice() == null ? batch.getPrice() : request.unitPrice();
        BigDecimal subtotal = request.quantity().multiply(unitPrice);
        BigDecimal shippingFee = BigDecimal.ZERO;
        BigDecimal grandTotal = subtotal.add(shippingFee);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expectedDeliveryDate = now.plusDays(demoDeliveryDays(buyer));
        BigDecimal depositAmount = paymentMethod == PaymentMethod.DEPOSIT_50 ? grandTotal.multiply(new BigDecimal("0.50")) : null;
        BigDecimal remainingAmount = paymentMethod == PaymentMethod.DEPOSIT_50 ? grandTotal.subtract(depositAmount) : BigDecimal.ZERO;

        OrderEntity order = orderRepository.save(OrderEntity.builder()
                .buyerCompanyId(buyer.getId())
                .supplierCompanyId(supplier.getId())
                .branchId(request.branchId())
                .status(paymentMethod == PaymentMethod.DEPOSIT_50 ? OrderStatusEnum.PENDING_DEPOSIT : OrderStatusEnum.PENDING_PAYMENT)
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .totalAmount(grandTotal)
                .paymentMethod("BANK_TRANSFER_DEMO")
                .paymentOption(paymentMethod.name())
                .paymentStatus("WAITING_TRANSFER")
                .escrowStatus("NOT_FUNDED")
                .depositRate(paymentMethod == PaymentMethod.DEPOSIT_50 ? new BigDecimal("50") : null)
                .depositAmount(depositAmount)
                .balanceAmount(remainingAmount)
                .remainingAmount(remainingAmount)
                .deliveryName(firstText(buyer.getOwnerName(), buyer.getName()))
                .deliveryPhone(trim(buyer.getPhone()))
                .deliveryProvince(trim(buyer.getProvince()))
                .deliveryWard(trim(buyer.getWard()))
                .deliveryAddress(trim(buyer.getAddress()))
                .shippingAddressSnapshot(addressSnapshot(buyer))
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
                .balanceAmount(remainingAmount)
                .status(InvoiceStatusEnum.UNPAID)
                .createdAt(now)
                .build());

        PaymentEntity payment = paymentRepository.save(buildInitialPayment(invoice, order, paymentMethod, grandTotal, depositAmount, now));
        ShipmentEntity shipment = null;
        if (shipment != null) {
            shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(shipment.getStatus().name())
                .description("Đã lưu thông tin vận chuyển dự kiến. GHN sandbox chỉ quote phí, chưa tạo vận đơn thật.")
                .eventTime(now)
                .build());

        }
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
        order.setStatus(deposit ? OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM : OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM);
        order.setPaymentStatus(deposit ? "PARTIALLY_PAID" : "PAID");
        order.setEscrowStatus(deposit ? "PARTIALLY_HELD" : "HELD");
        order.setUpdatedAt(now);
        orderRepository.save(order);
        createEscrowHold(order, payment, payment.getAmount(), deposit ? "Platform holds buyer deposit" : "Platform holds full payment from buyer", now);
        markLatestInvoiceStatus(orderId, deposit ? InvoiceStatusEnum.PARTIAL : InvoiceStatusEnum.PAID);
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
        order.setPaymentStatus("PAID");
        order.setEscrowStatus("HELD");
        order.setStatus(OrderStatusEnum.WAITING_BUYER_CONFIRM);
        order.setUpdatedAt(now);
        orderRepository.save(order);
        createEscrowHold(order, payment, remaining, "Platform holds remaining payment", now);
        markLatestInvoiceStatus(orderId, InvoiceStatusEnum.PAID);
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
        if (OrderStatusEnum.WAITING_BUYER_CONFIRM.equals(order.getStatus())) {
            releaseEscrowAndComplete(order);
            return;
        }
        if (!OrderStatusEnum.CONFIRMED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only confirmed orders can be received");
        }

        ShipmentEntity shipment = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));
        if (!ShipmentStatusEnum.WAITING_CONFIRMATION.equals(shipment.getStatus())) {
            throw new IllegalArgumentException("Shipment is not waiting for buyer confirmation");
        }

        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(ShipmentStatusEnum.DELIVERED);
        shipment.setDeliveredAt(now);
        order.setStatus(OrderStatusEnum.DELIVERED);
        shipmentRepository.save(shipment);
        orderRepository.save(order);
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(ShipmentStatusEnum.DELIVERED.name())
                .description("Buyer đã xác nhận nhận hàng")
                .eventTime(now)
                .build());
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
                .createdByUserId(currentUserId)
                .title(trim(request.title()))
                .description(trim(request.description()))
                .status(ComplaintStatusEnum.OPEN)
                .severity(firstText(request.severity(), "MEDIUM"))
                .createdAt(LocalDateTime.now())
                .build());
        return mapComplaint(complaint);
    }

    private List<BuyerOrderDto> mapOrders(List<OrderEntity> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }

        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        Map<Long, List<OrderItemEntity>> itemsByOrder = orderItemRepository.findByOrderIdIn(orderIds).stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId));
        Map<Long, InvoiceEntity> invoiceByOrder = latestByOrder(invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds), InvoiceEntity::getOrderId, InvoiceEntity::getCreatedAt);
        List<Long> invoiceIds = invoiceByOrder.values().stream().map(InvoiceEntity::getId).filter(Objects::nonNull).toList();
        Map<Long, List<PaymentEntity>> paymentsByInvoice = invoiceIds.isEmpty()
                ? Map.of()
                : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds).stream()
                        .collect(Collectors.groupingBy(PaymentEntity::getInvoiceId));
        Map<Long, ShipmentEntity> shipmentByOrder = latestByOrder(shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds), ShipmentEntity::getOrderId, ShipmentEntity::getCreatedAt);
        Map<Long, List<ComplaintEntity>> complaintsByOrder = complaintRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds).stream()
                .collect(Collectors.groupingBy(ComplaintEntity::getOrderId));
        Map<Long, BranchEntity> branchesById = branchRepository.findByIdIn(
                        orders.stream().map(OrderEntity::getBranchId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(BranchEntity::getId, Function.identity()));
        Map<Long, CompanyEntity> companiesById = companyRepository.findAllById(
                        orders.stream()
                                .flatMap(order -> List.of(order.getSupplierCompanyId(), order.getBuyerCompanyId()).stream())
                                .filter(Objects::nonNull)
                                .collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));

        List<OrderItemEntity> allItems = itemsByOrder.values().stream().flatMap(Collection::stream).toList();
        Map<Long, ProductEntity> productsById = productRepository.findAllById(
                        allItems.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, BatchEntity> batchesById = batchRepository.findAllById(
                        allItems.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(BatchEntity::getId, Function.identity()));

        Map<Long, List<BuyerOrderDto.TrackingEventDto>> trackingByShipment = new HashMap<>();
        for (ShipmentEntity shipment : shipmentByOrder.values()) {
            trackingByShipment.put(shipment.getId(), shipmentEventRepository.findByShipmentIdOrderByEventTimeAsc(shipment.getId()).stream()
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
                        paymentsByInvoice,
                        complaintsByOrder.getOrDefault(order.getId(), List.of()),
                        branchesById,
                        companiesById,
                        productsById,
                        batchesById))
                .toList();
    }

    private BuyerOrderDto mapOrder(
            OrderEntity order,
            List<OrderItemEntity> items,
            InvoiceEntity invoice,
            ShipmentEntity shipment,
            Map<Long, List<BuyerOrderDto.TrackingEventDto>> trackingByShipment,
            Map<Long, List<PaymentEntity>> paymentsByInvoice,
            List<ComplaintEntity> complaints,
            Map<Long, BranchEntity> branchesById,
            Map<Long, CompanyEntity> companiesById,
            Map<Long, ProductEntity> productsById,
            Map<Long, BatchEntity> batchesById) {
        List<BuyerOrderDto.ItemDto> itemDtos = items.stream()
                .map(item -> mapItem(item, productsById.get(item.getProductId()), batchesById.get(item.getBatchId())))
                .toList();
        BigDecimal paidAmount = invoice == null
                ? BigDecimal.ZERO
                : paymentsByInvoice.getOrDefault(invoice.getId(), List.of()).stream()
                        .map(payment -> payment.getPaidAmount() == null ? BigDecimal.ZERO : payment.getPaidAmount())
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        BranchEntity branch = branchesById.get(order.getBranchId());
        CompanyEntity supplier = companiesById.get(order.getSupplierCompanyId());
        List<BuyerOrderDto.TrackingEventDto> trackingEvents = shipment == null
                ? List.of(new BuyerOrderDto.TrackingEventDto("Order created", formatDateTime(order.getCreatedAt()), true, order.getStatus().name(), null))
                : trackingByShipment.getOrDefault(shipment.getId(), List.of());
        if (trackingEvents.isEmpty()) {
            trackingEvents = List.of(new BuyerOrderDto.TrackingEventDto("Shipment created", formatDateTime(shipment.getCreatedAt()), true, shipment.getStatus().name(), null));
        }

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
                order.getStatus().name(),
                summarizeProduct(itemDtos),
                summarizeQuantity(itemDtos),
                itemDtos,
                safeAmount(order.getSubtotal()),
                safeAmount(order.getShippingFee()),
                safeAmount(order.getTotalAmount()),
                formatMoney(safeAmount(order.getTotalAmount())),
                order.getPaymentMethod(),
                order.getDepositRate(),
                order.getDepositAmount(),
                order.getBalanceAmount(),
                order.getDeliveryName(),
                order.getDeliveryPhone(),
                order.getDeliveryProvince(),
                null,
                order.getDeliveryWard(),
                order.getDeliveryAddress(),
                shipment == null ? null : shipment.getProviderCode(),
                shipment == null ? null : firstText(shipment.getProviderName(), shipment.getCarrierName()),
                shipment == null ? null : firstText(shipment.getServiceName(), shipment.getShippingMethod()),
                shipment == null ? null : shipment.getShippingPayer(),
                shipment == null ? null : shipment.getEstimatedDeliveryTime(),
                trackingEvents,
                shipment == null ? null : shipment.getDriverName(),
                shipment == null ? null : shipment.getDriverPhone(),
                shipment == null ? null : shipment.getVehicleInfo(),
                shipment == null ? null : shipment.getTrackingCode(),
                invoice == null ? null : invoice.getInvoiceNumber(),
                paidAmount,
                invoice == null ? null : invoice.getDueDate(),
                invoice == null || invoice.getStatus() == null ? null : invoice.getStatus().name(),
                invoice == null ? List.of() : paymentsByInvoice.getOrDefault(invoice.getId(), List.of()).stream().map(this::mapPayment).toList(),
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

    private BuyerOrderDto.PaymentDto mapPayment(PaymentEntity payment) {
        return new BuyerOrderDto.PaymentDto(
                payment.getId(),
                payment.getAmount(),
                payment.getPaidAmount(),
                payment.getPaymentMethod(),
                payment.getPaymentType(),
                payment.getStatus(),
                payment.getEscrowStatus(),
                payment.getDueDate(),
                payment.getPaymentDate(),
                payment.getNote());
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

    private <T> Map<Long, T> latestByOrder(List<T> values, Function<T, Long> orderId, Function<T, LocalDateTime> createdAt) {
        return values.stream().collect(Collectors.toMap(
                orderId,
                Function.identity(),
                (left, right) -> Comparator.nullsLast(LocalDateTime::compareTo).compare(createdAt.apply(left), createdAt.apply(right)) >= 0 ? left : right));
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
        if (expectedSubtotal != null && expectedSubtotal.subtract(request.subtotal()).abs().compareTo(SUBTOTAL_TOLERANCE) > 0) {
            throw new IllegalArgumentException("subtotal does not match quantity * unitPrice");
        }
        parsePaymentMethod(firstText(request.paymentOption(), request.paymentMethod()));
    }

    private void validateDeposit(BuyerQuickOrderRequestDto request, BigDecimal grandTotal) {
        if (request.depositAmount() == null || request.balanceAmount() == null) {
            throw new IllegalArgumentException("depositAmount and balanceAmount are required for DEPOSIT_50");
        }
        if (request.depositAmount().compareTo(BigDecimal.ZERO) <= 0 || request.balanceAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Deposit amounts are invalid");
        }
        BigDecimal expectedDeposit = grandTotal.multiply(new BigDecimal("0.50"));
        if (expectedDeposit.subtract(request.depositAmount()).abs().compareTo(SUBTOTAL_TOLERANCE) > 0) {
            throw new IllegalArgumentException("depositAmount must equal 50% of grandTotal");
        }
        if (request.depositAmount().add(request.balanceAmount()).subtract(grandTotal).abs().compareTo(SUBTOTAL_TOLERANCE) > 0) {
            throw new IllegalArgumentException("depositAmount + balanceAmount must equal grandTotal");
        }
    }

    private LocalDate validateCreditLimit(Long supplierCompanyId, Long buyerCompanyId, BigDecimal grandTotal, Integer creditTermDays) {
        if (creditTermDays == null || creditTermDays <= 0) {
            throw new IllegalArgumentException("creditTermDays is required for CREDIT");
        }
        CreditLimitEntity creditLimit = creditLimitRepository.findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId, buyerCompanyId)
                .orElseThrow(() -> new IllegalArgumentException("Credit limit is not configured for this buyer and supplier"));
        if (Boolean.TRUE.equals(creditLimit.getIsBlocked())) {
            throw new IllegalArgumentException(creditLimit.getBlockedReason() == null || creditLimit.getBlockedReason().isBlank()
                    ? "Credit limit is blocked"
                    : creditLimit.getBlockedReason());
        }
        BigDecimal outstanding = calculateOutstandingCredit(supplierCompanyId, buyerCompanyId);
        BigDecimal remaining = safeAmount(creditLimit.getCreditLimit()).subtract(outstanding);
        if (grandTotal.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Không đủ hạn mức công nợ.");
        }
        return LocalDate.now().plusDays(creditTermDays);
    }

    private BigDecimal calculateOutstandingCredit(Long supplierCompanyId, Long buyerCompanyId) {
        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId, buyerCompanyId);
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        if (orderIds.isEmpty()) {
            return BigDecimal.ZERO;
        }
        List<InvoiceEntity> invoices = invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        return invoices.stream()
                .filter(invoice -> invoice.getStatus() != InvoiceStatusEnum.PAID)
                .map(invoice -> safeAmount(invoice.getAdjustedAmount()).subtract(paidAmountForInvoice(invoice.getId(), payments)))
                .filter(amount -> amount.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal paidAmountForInvoice(Long invoiceId, List<PaymentEntity> payments) {
        return payments.stream()
                .filter(payment -> Objects.equals(invoiceId, payment.getInvoiceId()))
                .map(payment -> payment.getPaidAmount() == null ? safeAmount(payment.getAmount()) : safeAmount(payment.getPaidAmount()))
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

    private void createEscrowHold(OrderEntity order, PaymentEntity payment, BigDecimal amount, String description, LocalDateTime now) {
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
                || escrowTransactionRepository.existsByOrderIdAndTransactionTypeAndStatus(order.getId(), "RELEASE", "SUCCESS")) {
            throw new IllegalArgumentException("Escrow already released");
        }
        if (supplierPayoutRepository.existsByOrderId(order.getId())) {
            throw new IllegalArgumentException("Payout already exists");
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
        supplierPayoutRepository.save(SupplierPayoutEntity.builder()
                .orderId(order.getId())
                .supplierCompanyId(order.getSupplierCompanyId())
                .amount(heldAmount)
                .payoutStatus("PAID")
                .transactionCode("PAYOUT-" + order.getId())
                .paidAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    private PaymentEntity buildInitialPayment(
            InvoiceEntity invoice,
            OrderEntity order,
            PaymentMethod paymentMethod,
            BigDecimal grandTotal,
            BigDecimal depositAmount,
            LocalDateTime now) {
        BigDecimal amount = paymentMethod == PaymentMethod.DEPOSIT_50 ? depositAmount : grandTotal;
        String paymentType = paymentMethod == PaymentMethod.DEPOSIT_50 ? "DEPOSIT" : "FULL";
        String transferContent = (paymentMethod == PaymentMethod.DEPOSIT_50 ? "AGRI-DEPOSIT-" : "AGRI-ORDER-") + order.getId();
        return PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .amount(amount)
                .paidAmount(BigDecimal.ZERO)
                .paymentMethod("BANK_TRANSFER_DEMO")
                .paymentType(paymentType)
                .status("WAITING_TRANSFER")
                .escrowStatus("NOT_FUNDED")
                .transferContent(transferContent)
                .paymentDate(now)
                .createdAt(now)
                .updatedAt(now)
                .note(paymentMethod == PaymentMethod.DEPOSIT_50
                        ? "Buyer chọn đặt cọc 50%, chờ chuyển khoản demo"
                        : "Buyer chọn thanh toán 100% qua sàn, chờ chuyển khoản demo")
                .build();
    }

    private PaymentEntity buildInitialPayment(
            InvoiceEntity invoice,
            PaymentMethod paymentMethod,
            BuyerQuickOrderRequestDto request,
            BigDecimal grandTotal,
            LocalDate creditDueDate,
            LocalDateTime now) {
        BigDecimal amount = switch (paymentMethod) {
            case FULL_PAYMENT, ESCROW_TRANSFER -> grandTotal;
            case DEPOSIT_50 -> request.depositAmount();
            case CREDIT -> grandTotal;
        };
        String paymentType = switch (paymentMethod) {
            case FULL_PAYMENT, ESCROW_TRANSFER -> "ESCROW";
            case DEPOSIT_50 -> "DEPOSIT";
            case CREDIT -> "CREDIT";
        };
        String status = paymentMethod == PaymentMethod.CREDIT ? "UNPAID" : "PENDING";
        String escrowStatus = paymentMethod == PaymentMethod.CREDIT ? null : "WAITING_BUYER_PAYMENT";
        String note = switch (paymentMethod) {
            case FULL_PAYMENT, ESCROW_TRANSFER -> "Buyer chọn chuyển khoản qua sàn, chờ thanh toán";
            case DEPOSIT_50 -> "Buyer chọn đặt cọc 50%, chờ thanh toán khoản cọc";
            case CREDIT -> "Buyer chọn công nợ, không yêu cầu thanh toán ngay";
        };
        return PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .amount(amount)
                .paidAmount(BigDecimal.ZERO)
                .paymentMethod(paymentMethod.name())
                .paymentType(paymentType)
                .status(status)
                .escrowStatus(escrowStatus)
                .dueDate(paymentMethod == PaymentMethod.CREDIT ? creditDueDate : null)
                .paymentDate(now)
                .note(note)
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
                .receiverWard(trim(request.deliveryWard()))
                .receiverAddress(trim(request.deliveryAddress()))
                .quoteStatus(firstText(request.shippingStatus(), "PENDING_QUOTE"))
                .estimatedDeliveryTime(trim(request.estimatedDeliveryTime()))
                .shippingPayer(firstText(request.shippingPayer(), "BUYER"))
                .shippingFee(shippingFee)
                .feeConfirmed(shippingFee.compareTo(BigDecimal.ZERO) > 0)
                .status(ShipmentStatusEnum.PREPARING)
                .incidentNote("Quote only. GHN sandbox fee is stored here; no real waybill has been created.")
                .createdAt(now)
                .build();
    }

    private InvoiceStatusEnum invoiceStatus(PaymentMethod paymentMethod) {
        return InvoiceStatusEnum.UNPAID;
    }

    private PaymentMethod parsePaymentMethod(String raw) {
        String normalized = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if ("FULL_PAYMENT".equals(normalized) || "ESCROW_TRANSFER".equals(normalized)) {
            return PaymentMethod.FULL_PAYMENT;
        }
        if ("DEPOSIT_50".equals(normalized)) {
            return PaymentMethod.DEPOSIT_50;
        }
        try {
            return PaymentMethod.valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("paymentMethod is invalid");
        }
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

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String addressSnapshot(CompanyEntity buyer) {
        return List.of(buyer.getAddress(), buyer.getWard(), buyer.getProvince()).stream()
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
        CREDIT
    }
}
