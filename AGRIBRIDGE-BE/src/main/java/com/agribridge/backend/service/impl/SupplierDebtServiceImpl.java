package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.SupplierDebtDtos;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CreditLimitEntity;
import com.agribridge.backend.entity.DebtAdjustmentEntity;
import com.agribridge.backend.entity.DebtReminderEntity;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.InvoiceItemEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.PaymentAllocationEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.AdjustmentTypeEnum;
import com.agribridge.backend.entity.enums.CreditLimitStatusEnum;
import com.agribridge.backend.entity.enums.DebtReminderStatusEnum;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.CreditLimitRepository;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.DebtAdjustmentRepository;
import com.agribridge.backend.repository.DebtReminderRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.InvoiceItemRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentAllocationRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.SupplierDebtService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierDebtServiceImpl implements SupplierDebtService {

    private final CurrentUserService currentUserService;
    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final DebtAdjustmentRepository debtAdjustmentRepository;
    private final DebtReminderRepository debtReminderRepository;
    private final CreditLimitRepository creditLimitRepository;
    private final CompanyRepository companyRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final ShipmentRepository shipmentRepository;
    private final NotificationRepository notificationRepository;

    @Override
    @Transactional(readOnly = true)
    public SupplierDebtDtos.Overview getDebts() {
        DebtContext context = loadContext();
        return new SupplierDebtDtos.Overview(buildKpis(context), buildBuyerRows(context));
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierDebtDtos.BuyerDetail getBuyerDetail(Long buyerId) {
        DebtContext context = loadContext();
        SupplierDebtDtos.BuyerDebt summary = buildBuyerRow(buyerId, context);
        List<InvoiceEntity> invoices = invoicesOfBuyer(buyerId, context);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<SupplierDebtDtos.PaymentItem> payments = context.payments().stream()
                .filter(payment -> invoiceIds.contains(payment.getInvoiceId()))
                .sorted(Comparator.comparing(PaymentEntity::getPaymentDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(payment -> {
                    Long confirmedByUserId = payment.getConfirmedByUserId();
                    UserEntity confirmedBy = confirmedByUserId == null ? null : context.usersById().get(confirmedByUserId);
                    return toPaymentItem(payment, confirmedBy);
                })
                .toList();
        List<SupplierDebtDtos.AdjustmentItem> adjustments = context.adjustments().stream()
                .filter(item -> invoiceIds.contains(item.getInvoiceId()))
                .map(this::toAdjustmentItem)
                .toList();
        List<DebtReminderEntity> buyerReminders = context.reminders().stream()
                .filter(item -> item.getInvoiceId() == null || invoiceIds.contains(item.getInvoiceId()))
                .toList();
        Map<Long, Boolean> reminderReadState = buyerReminders.isEmpty()
                ? Map.of()
                : notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefIdIn(
                                buyerId,
                                NotificationTypeEnum.DEBT_REMINDER,
                                "debt_reminders",
                                buyerReminders.stream().map(DebtReminderEntity::getId).toList())
                        .stream()
                        .collect(Collectors.toMap(NotificationEntity::getRefId, item -> Boolean.TRUE.equals(item.getIsRead()), (a, b) -> a || b));
        List<SupplierDebtDtos.ReminderItem> reminders = context.reminders().stream()
                .filter(item -> item.getInvoiceId() == null || invoiceIds.contains(item.getInvoiceId()))
                .map(item -> toReminderItem(item, reminderReadState.get(item.getId())))
                .toList();
        return new SupplierDebtDtos.BuyerDetail(
                summary,
                invoices.stream().map(invoice -> toInvoiceItem(invoice, context)).toList(),
                payments,
                adjustments,
                reminders,
                toCreditLimitItem(context.creditByBuyer().get(buyerId), buyerId));
    }

    @Override
    @Transactional
    public SupplierDebtDtos.CreditLimitItem upsertCreditLimit(SupplierDebtDtos.CreditLimitRequest request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        if (request == null || request.buyerId() == null) throw new IllegalArgumentException("buyerId is required");
        if (request.creditLimit() == null || request.creditLimit().compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("creditLimit is invalid");
        if (!List.of(7, 15, 30).contains(request.paymentTermDays())) throw new IllegalArgumentException("paymentTermDays must be 7, 15 or 30");
        LocalDateTime now = LocalDateTime.now();
        CreditLimitStatusEnum status = parseCreditStatus(request.status());
        CreditLimitEntity entity = creditLimitRepository.findBySupplierCompanyIdAndBuyerCompanyId(supplierCompanyId, request.buyerId())
                .orElseGet(() -> CreditLimitEntity.builder()
                        .supplierCompanyId(supplierCompanyId)
                        .buyerCompanyId(request.buyerId())
                        .createdAt(now)
                        .build());
        entity.setCreditLimit(request.creditLimit());
        entity.setPaymentTermDays(request.paymentTermDays());
        entity.setStatus(status);
        entity.setIsBlocked(CreditLimitStatusEnum.SUSPENDED.equals(status));
        entity.setBlockedReason(CreditLimitStatusEnum.SUSPENDED.equals(status) ? "Bị tạm khóa công nợ" : null);
        entity.setNote(clean(request.note()));
        entity.setUpdatedAt(now);
        return toCreditLimitItem(creditLimitRepository.save(entity), request.buyerId());
    }

    @Override
    @Transactional
    public SupplierDebtDtos.BuyerDetail createPayment(SupplierDebtDtos.PaymentRequest request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        UserEntity user = currentUserService.requireCurrentUser();
        if (request == null || request.buyerId() == null) throw new IllegalArgumentException("buyerId is required");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("amount is invalid");
        if (request.allocations() == null || request.allocations().isEmpty()) throw new IllegalArgumentException("allocations are required");
        BigDecimal allocationTotal = request.allocations().stream().map(SupplierDebtDtos.PaymentAllocationRequest::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allocationTotal.compareTo(request.amount()) != 0) throw new IllegalArgumentException("allocation total must equal payment amount");
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime paymentDate = request.paymentDate() == null ? now : request.paymentDate();
        InvoiceEntity firstInvoice = requireSupplierInvoice(supplierCompanyId, request.allocations().get(0).invoiceId());
        PaymentEntity payment = paymentRepository.save(PaymentEntity.builder()
                .invoiceId(firstInvoice.getId())
                .orderId(firstInvoice.getOrderId())
                .buyerCompanyId(request.buyerId())
                .amount(request.amount())
                .paidAmount(request.amount())
                .paymentMethod(firstText(request.paymentMethod(), "BANK_TRANSFER"))
                .paymentType("SUPPLIER_DEBT_PAYMENT")
                .status("PAID")
                .paymentDate(paymentDate)
                .createdAt(now)
                .updatedAt(now)
                .confirmedByUserId(user.getId())
                .note(clean(request.note()))
                .build());
        for (SupplierDebtDtos.PaymentAllocationRequest allocation : request.allocations()) {
            InvoiceEntity invoice = requireSupplierInvoice(supplierCompanyId, allocation.invoiceId());
            if (!Objects.equals(invoice.getBuyerCompanyId(), request.buyerId())) throw new IllegalArgumentException("invoice does not belong to buyer");
            BigDecimal paid = paidAmount(invoice.getId());
            BigDecimal remaining = invoiceAmount(invoice).subtract(paid);
            if (allocation.amount() == null || allocation.amount().compareTo(BigDecimal.ZERO) <= 0 || allocation.amount().compareTo(remaining) > 0) {
                throw new IllegalArgumentException("allocation amount is invalid");
            }
            paymentAllocationRepository.save(PaymentAllocationEntity.builder()
                    .paymentId(payment.getId())
                    .invoiceId(invoice.getId())
                    .amount(allocation.amount())
                    .createdAt(now)
                    .build());
            BigDecimal paidAfter = paid.add(allocation.amount());
            invoice.setStatus(resolveInvoiceStatus(invoice, paidAfter));
            invoiceRepository.save(invoice);
        }
        paymentRepository.save(payment);
        return getBuyerDetail(request.buyerId());
    }

    @Override
    @Transactional
    public SupplierDebtDtos.BuyerDetail createAdjustment(SupplierDebtDtos.AdjustmentRequest request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        UserEntity user = currentUserService.requireCurrentUser();
        if (request == null || request.invoiceId() == null) throw new IllegalArgumentException("invoiceId is required");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("amount is invalid");
        InvoiceEntity invoice = requireSupplierInvoice(supplierCompanyId, request.invoiceId());
        AdjustmentTypeEnum type = parseAdjustmentType(request.adjustmentType());
        BigDecimal signedAmount = type == AdjustmentTypeEnum.SURCHARGE ? request.amount() : request.amount().negate();
        invoice.setAdjustedAmount(invoiceAmount(invoice).add(signedAmount).max(BigDecimal.ZERO));
        invoice.setStatus(resolveInvoiceStatus(invoice, paidAmount(invoice.getId())));
        invoiceRepository.save(invoice);
        debtAdjustmentRepository.save(DebtAdjustmentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(invoice.getOrderId())
                .adjustmentType(type)
                .amount(signedAmount)
                .description(clean(request.description()))
                .createdByUserId(user.getId())
                .createdAt(LocalDateTime.now())
                .build());
        return getBuyerDetail(invoice.getBuyerCompanyId());
    }

    @Override
    @Transactional
    public SupplierDebtDtos.BuyerDetail createReminder(SupplierDebtDtos.ReminderRequest request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        UserEntity user = currentUserService.requireCurrentUser();
        if (request == null || request.buyerId() == null) throw new IllegalArgumentException("buyerId is required");
        if (request.invoiceId() == null) throw new IllegalArgumentException("invoiceId is required");
        InvoiceEntity invoice = requireSupplierInvoice(supplierCompanyId, request.invoiceId());
        BigDecimal remaining = invoiceAmount(invoice).subtract(paidAmount(invoice.getId())).max(BigDecimal.ZERO);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0 || InvoiceStatusEnum.PAID.equals(invoice.getStatus())) {
            throw new IllegalArgumentException("Hóa đơn đã thanh toán, không thể nhắc nợ.");
        }
        BigDecimal amount = request.amount() == null && invoice != null
                ? remaining
                : nullToZero(request.amount());
        LocalDateTime now = LocalDateTime.now();
        OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElse(null);
        CompanyEntity supplierCompany = companyRepository.findById(supplierCompanyId).orElse(null);
        String supplierName = supplierCompany == null ? "Nhà cung cấp" : firstText(supplierCompany.getName(), "Nhà cung cấp");
        String invoiceCode = firstText(invoice.getInvoiceNumber(), "N/A");
        String orderCode = order == null ? "ORD-N/A" : "ORD-" + order.getId();
        InvoiceItemEntity mainItem = invoiceItemRepository.findByInvoiceIdIn(List.of(invoice.getId())).stream().findFirst().orElse(null);
        String productName = mainItem == null ? "Sản phẩm" : firstText(mainItem.getDescription(), "Sản phẩm");
        BigDecimal quantity = mainItem == null ? BigDecimal.ZERO : nullToZero(mainItem.getQuantity());
        String unit = mainItem == null ? "" : firstText(mainItem.getUnit(), "");
        LocalDateTime confirmedReceivedAt = order == null ? null : shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(order.getId()).map(ShipmentEntity::getConfirmedReceivedAt).orElse(null);
        String dueLabel = dueLabel(paymentPlanType(invoice), invoice.getDueDate(), confirmedReceivedAt, null);
        String defaultMessage = "Nhà cung cấp " + supplierName + " nhắc bạn thanh toán đơn " + orderCode + ": "
                + productName + " " + formatQuantity(quantity, unit) + ", còn phải trả " + formatMoney(amount)
                + ". Hạn thanh toán: " + dueLabel + ". Mã hóa đơn: " + invoiceCode + ".";
        DebtReminderEntity reminder = debtReminderRepository.save(DebtReminderEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order == null ? null : order.getId())
                .supplierCompanyId(supplierCompanyId)
                .buyerCompanyId(request.buyerId())
                .amount(amount.max(BigDecimal.ZERO))
                .message(firstText(request.message(), defaultMessage))
                .channel(firstText(request.channel(), "NOTIFICATION"))
                .status(DebtReminderStatusEnum.SENT)
                .createdByUserId(user.getId())
                .sentAt(now)
                .createdAt(now)
                .build());
        boolean sendSystemNotification = !Boolean.FALSE.equals(request.sendSystemNotification());
        boolean markOnBuyerDebtPage = !Boolean.FALSE.equals(request.markOnBuyerDebtPage());
        if (sendSystemNotification || markOnBuyerDebtPage) {
            String metadata = "{"
                    + "\"invoiceId\":" + reminder.getInvoiceId()
                    + ",\"invoiceCode\":\"" + json(invoiceCode) + "\""
                    + ",\"orderId\":" + (order == null ? "null" : order.getId())
                    + ",\"orderCode\":\"" + json(orderCode) + "\""
                    + ",\"productName\":\"" + json(productName) + "\""
                    + ",\"quantity\":" + quantity
                    + ",\"unit\":\"" + json(unit) + "\""
                    + ",\"buyerCompanyId\":" + request.buyerId()
                    + ",\"buyerName\":\"" + json(firstText(companyRepository.findById(request.buyerId()).map(CompanyEntity::getName).orElse("Buyer"), "Buyer")) + "\""
                    + ",\"supplierCompanyId\":" + supplierCompanyId
                    + ",\"supplierName\":\"" + json(supplierName) + "\""
                    + ",\"amount\":" + amount
                    + ",\"dueDate\":\"" + (invoice.getDueDate() == null ? "" : invoice.getDueDate()) + "\""
                    + ",\"dueLabel\":\"" + json(dueLabel) + "\""
                    + ",\"type\":\"DEBT_REMINDER\""
                    + "}";
            userRepository.findFirstByCompanyIdAndRole(request.buyerId(), UserRoleEnum.OWNER)
                    .ifPresent(owner -> notificationRepository.save(NotificationEntity.builder()
                            .userId(owner.getId())
                            .companyId(request.buyerId())
                            .type(NotificationTypeEnum.DEBT_REMINDER)
                            .title("Nhắc thanh toán công nợ")
                            .body(supplierName + " nhắc bạn thanh toán đơn " + orderCode + ": " + productName + " " + formatQuantity(quantity, unit) + ", còn " + formatMoney(amount) + ".")
                            .metadata(metadata)
                            .refTable("debt_reminders")
                            .refId(reminder.getId())
                            .isRead(Boolean.FALSE)
                            .createdAt(now)
                            .build()));
        }
        return getBuyerDetail(request.buyerId());
    }

    private DebtContext loadContext() {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(supplierCompanyId).stream()
                .filter(order -> !OrderStatusEnum.CANCELLED.equals(order.getStatus()))
                .toList();
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();
        List<InvoiceEntity> invoices = orderIds.isEmpty() ? List.of() : invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<InvoiceItemEntity> invoiceItems = invoiceIds.isEmpty() ? List.of() : invoiceItemRepository.findByInvoiceIdIn(invoiceIds);
        List<OrderItemEntity> orderItems = orderIds.isEmpty() ? List.of() : orderItemRepository.findByOrderIdIn(orderIds);
        List<Long> productIds = java.util.stream.Stream.concat(
                        invoiceItems.stream().map(InvoiceItemEntity::getProductId),
                        orderItems.stream().map(OrderItemEntity::getProductId))
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        List<Long> batchIds = orderItems.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).distinct().toList();
        Map<Long, ProductEntity> productsById = productIds.isEmpty() ? Map.of()
                : productRepository.findByIdIn(productIds).stream().collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, BatchEntity> batchesById = batchIds.isEmpty() ? Map.of()
                : batchRepository.findAllById(batchIds).stream().collect(Collectors.toMap(BatchEntity::getId, Function.identity()));
        Map<Long, InvoiceLine> orderLineByOrderId = orderItems.stream()
                .collect(Collectors.toMap(OrderItemEntity::getOrderId, item -> toInvoiceLine(item, productsById, batchesById), (a, b) -> a));
        Map<Long, InvoiceLine> invoiceMainItemByInvoiceId = invoiceItems.stream()
                .collect(Collectors.toMap(
                        InvoiceItemEntity::getInvoiceId,
                        item -> toInvoiceLine(item, orderLineByOrderId.get(invoices.stream()
                                .filter(invoice -> Objects.equals(invoice.getId(), item.getInvoiceId()))
                                .map(InvoiceEntity::getOrderId)
                                .findFirst()
                                .orElse(null)), productsById),
                        (a, b) -> a));
        invoices.forEach(invoice -> invoiceMainItemByInvoiceId.putIfAbsent(invoice.getId(), orderLineByOrderId.get(invoice.getOrderId())));
        List<ShipmentEntity> shipments = orderIds.isEmpty() ? List.of() : shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        Map<Long, LocalDateTime> confirmedReceivedAtByOrderId = shipments.stream()
                .filter(item -> item.getConfirmedReceivedAt() != null)
                .collect(Collectors.toMap(ShipmentEntity::getOrderId, ShipmentEntity::getConfirmedReceivedAt, (a, b) -> a.isAfter(b) ? a : b));
        Map<Long, LocalDateTime> expectedDeliveryAtByOrderId = orders.stream()
                .filter(order -> order.getExpectedDeliveryDate() != null)
                .collect(Collectors.toMap(OrderEntity::getId, OrderEntity::getExpectedDeliveryDate, (a, b) -> a.isAfter(b) ? a : b));
        Map<Long, LocalDateTime> expectedDeliveryFromShipmentByOrderId = shipments.stream()
                .map(item -> {
                    LocalDateTime expected = item.getEstimatedDeliveryAt() != null ? item.getEstimatedDeliveryAt() : item.getExpectedDeliveryDate();
                    return expected == null ? null : Map.entry(item.getOrderId(), expected);
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a.isAfter(b) ? a : b));
        expectedDeliveryFromShipmentByOrderId.forEach(expectedDeliveryAtByOrderId::putIfAbsent);
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        List<Long> paymentIds = payments.stream().map(PaymentEntity::getId).toList();
        List<PaymentAllocationEntity> allocations = paymentIds.isEmpty() ? List.of() : paymentAllocationRepository.findByPaymentIdIn(paymentIds);
        List<DebtAdjustmentEntity> adjustments = invoiceIds.isEmpty() ? List.of() : debtAdjustmentRepository.findByInvoiceIdInOrderByCreatedAtDesc(invoiceIds);
        List<DebtReminderEntity> reminders = invoiceIds.isEmpty() ? List.of() : debtReminderRepository.findByInvoiceIdInOrderByCreatedAtDesc(invoiceIds);
        Map<Long, PaymentEntity> paymentsById = payments.stream().collect(Collectors.toMap(PaymentEntity::getId, Function.identity()));
        Map<Long, BigDecimal> paidByInvoice = buildPaidByInvoice(payments, allocations, paymentsById);
        List<Long> buyerIds = orders.stream().map(OrderEntity::getBuyerCompanyId).filter(Objects::nonNull).distinct().toList();
        Map<Long, CompanyEntity> buyersById = buyerIds.isEmpty() ? Map.of() : companyRepository.findAllById(buyerIds).stream().collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
        Map<Long, CreditLimitEntity> creditByBuyer = buyerIds.isEmpty() ? Map.of() : creditLimitRepository.findBySupplierCompanyIdAndBuyerCompanyIdIn(supplierCompanyId, buyerIds).stream().collect(Collectors.toMap(CreditLimitEntity::getBuyerCompanyId, Function.identity()));
        List<Long> userIds = java.util.stream.Stream.concat(
                        payments.stream().map(PaymentEntity::getConfirmedByUserId),
                        reminders.stream().map(DebtReminderEntity::getCreatedByUserId))
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, UserEntity> usersById = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(UserEntity::getId, Function.identity()));
        Map<Long, OrderEntity> ordersById = orders.stream().collect(Collectors.toMap(OrderEntity::getId, Function.identity()));
        return new DebtContext(supplierCompanyId, orders, invoices, payments, adjustments, reminders, paidByInvoice, buyersById, creditByBuyer, usersById, ordersById, invoiceMainItemByInvoiceId, confirmedReceivedAtByOrderId, expectedDeliveryAtByOrderId);
    }

    private List<SupplierDebtDtos.Kpi> buildKpis(DebtContext context) {
        List<InvoiceCalc> calcs = context.invoices().stream()
                .map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId()), context.ordersById().get(invoice.getOrderId())))
                .toList();
        BigDecimal receivable = calcs.stream().map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdue = calcs.stream().filter(InvoiceCalc::overdue).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal dueSoon = calcs.stream().filter(InvoiceCalc::dueSoon).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate today = LocalDate.now();
        BigDecimal paidThisMonth = context.payments().stream()
                .filter(payment -> payment.getPaymentDate() != null && payment.getPaymentDate().getYear() == today.getYear() && payment.getPaymentDate().getMonth() == today.getMonth())
                .map(this::paymentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long overLimit = buildBuyerRows(context).stream().filter(row -> row.creditLimit().compareTo(BigDecimal.ZERO) > 0 && row.remainingCredit().compareTo(BigDecimal.ZERO) < 0).count();
        return List.of(
                new SupplierDebtDtos.Kpi("totalReceivable", "Tổng phải thu", receivable.add(paidThisMonth), formatMoney(receivable.add(paidThisMonth))),
                new SupplierDebtDtos.Kpi("paidThisMonth", "Đã thu tháng này", paidThisMonth, formatMoney(paidThisMonth)),
                new SupplierDebtDtos.Kpi("remainingReceivable", "Còn phải thu", receivable, formatMoney(receivable)),
                new SupplierDebtDtos.Kpi("dueSoon", "Sắp đến hạn", dueSoon, formatMoney(dueSoon)),
                new SupplierDebtDtos.Kpi("overdue", "Quá hạn", overdue, formatMoney(overdue)),
                new SupplierDebtDtos.Kpi("overLimitCustomers", "Khách vượt hạn mức", BigDecimal.valueOf(overLimit), String.valueOf(overLimit)));
    }

    private List<SupplierDebtDtos.BuyerDebt> buildBuyerRows(DebtContext context) {
        return context.orders().stream().map(OrderEntity::getBuyerCompanyId).filter(Objects::nonNull).distinct()
                .map(buyerId -> buildBuyerRow(buyerId, context))
                .sorted(Comparator.comparing(SupplierDebtDtos.BuyerDebt::remainingAmount, Comparator.reverseOrder()))
                .toList();
    }

    private SupplierDebtDtos.BuyerDebt buildBuyerRow(Long buyerId, DebtContext context) {
        List<InvoiceEntity> buyerInvoices = invoicesOfBuyer(buyerId, context);
        List<InvoiceCalc> calcs = buyerInvoices.stream()
                .map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId()), context.ordersById().get(invoice.getOrderId())))
                .toList();
        BigDecimal total = calcs.stream().map(InvoiceCalc::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = calcs.stream().map(InvoiceCalc::paid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = calcs.stream().map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdue = calcs.stream().filter(InvoiceCalc::overdue).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal dueSoon = calcs.stream().filter(InvoiceCalc::dueSoon).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        CreditLimitEntity credit = context.creditByBuyer().get(buyerId);
        BigDecimal limit = credit == null ? BigDecimal.ZERO : nullToZero(credit.getCreditLimit());
        BigDecimal usedCredit = calcs.stream().filter(item -> "CREDIT_TERM".equals(item.paymentPlanType())).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remainingCredit = limit.compareTo(BigDecimal.ZERO) > 0 ? limit.subtract(remaining) : BigDecimal.ZERO;
        String status = status(credit, overdue, dueSoon, remainingCredit);
        CompanyEntity buyer = context.buyersById().get(buyerId);
        for (int i = 0; i < buyerInvoices.size(); i++) {
            InvoiceEntity invoice = buyerInvoices.get(i);
            InvoiceCalc calc = calcs.get(i);
            boolean included = calc.remaining().compareTo(BigDecimal.ZERO) > 0
                    && !InvoiceStatusEnum.CANCELLED.equals(invoice.getStatus())
                    && !InvoiceStatusEnum.VOIDED.equals(invoice.getStatus());
            String reason = included ? "OK" : (calc.remaining().compareTo(BigDecimal.ZERO) <= 0 ? "OUTSTANDING_ZERO" : "INACTIVE_STATUS");
            log.info("DEBT_SUMMARY supplierCompanyId={} buyerCompanyId={} invoiceId={} orderCode={} totalAmount={} paidAmount={} adjustmentAmount={} outstandingAmount={} invoiceStatus={} paymentPlanType={} includedInDebtSummary={} reason={}",
                    context.supplierCompanyId(), buyerId, invoice.getId(), "ORD-" + invoice.getOrderId(),
                    nullToZero(invoice.getTotalAmount()), calc.paid(), invoiceAdjustmentAmount(invoice), calc.remaining(),
                    invoice.getStatus(), calc.paymentPlanType(), included, reason);
        }
        return new SupplierDebtDtos.BuyerDebt(buyerId, buyer == null ? "Chưa có" : buyer.getName(), calcs.size(),
                (int) calcs.stream().filter(item -> item.remaining().compareTo(BigDecimal.ZERO) > 0).count(),
                (int) calcs.stream().filter(InvoiceCalc::overdue).count(), total, paid, remaining, overdue, dueSoon,
                limit, usedCredit, remainingCredit, credit == null ? null : credit.getPaymentTermDays(),
                credit == null || credit.getStatus() == null ? "Chưa có" : credit.getStatus().name(), status, statusLabel(status));
    }

    private List<InvoiceEntity> invoicesOfBuyer(Long buyerId, DebtContext context) {
        return context.invoices().stream().filter(invoice -> Objects.equals(invoice.getBuyerCompanyId(), buyerId)).toList();
    }

    private InvoiceEntity requireSupplierInvoice(Long supplierCompanyId, Long invoiceId) {
        InvoiceEntity invoice = invoiceRepository.findById(invoiceId).orElseThrow(() -> new IllegalArgumentException("INVOICE_NOT_FOUND"));
        if (!Objects.equals(invoice.getSupplierCompanyId(), supplierCompanyId)) throw new IllegalArgumentException("INVOICE_NOT_BELONG_TO_SUPPLIER");
        if (InvoiceStatusEnum.CANCELLED.equals(invoice.getStatus()) || InvoiceStatusEnum.VOIDED.equals(invoice.getStatus())) throw new IllegalArgumentException("INVOICE_NOT_ACTIVE");
        return invoice;
    }

    private BigDecimal paidAmount(Long invoiceId) {
        List<PaymentEntity> payments = paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoiceId);
        List<Long> paymentIds = payments.stream().map(PaymentEntity::getId).toList();
        List<PaymentAllocationEntity> allocations = paymentIds.isEmpty() ? List.of() : paymentAllocationRepository.findByPaymentIdIn(paymentIds);
        Map<Long, PaymentEntity> paymentsById = payments.stream().collect(Collectors.toMap(PaymentEntity::getId, Function.identity(), (a, b) -> a));
        return nullToZero(buildPaidByInvoice(payments, allocations, paymentsById).get(invoiceId));
    }

    private SupplierDebtDtos.InvoiceItem toInvoiceItem(InvoiceEntity invoice, DebtContext context) {
        InvoiceCalc calc = calc(invoice, context.paidByInvoice().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId()), context.ordersById().get(invoice.getOrderId()));
        InvoiceLine mainItem = context.invoiceMainItemByInvoiceId().get(invoice.getId());
        LocalDateTime confirmedReceivedAt = context.confirmedReceivedAtByOrderId().get(invoice.getOrderId());
        LocalDateTime expectedDueAt = context.expectedDeliveryAtByOrderId().get(invoice.getOrderId());
        String paymentPlan = paymentPlanType(invoice);
        return new SupplierDebtDtos.InvoiceItem(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                displayInvoiceCode(invoice),
                invoice.getInvoiceNumber(),
                invoice.getOrderId(),
                "ORD-" + invoice.getOrderId(),
                "ORD-" + invoice.getOrderId(),
                mainItem == null ? null : mainItem.productName(),
                mainItem == null ? null : mainItem.quantity(),
                mainItem == null ? null : mainItem.unit(),
                mainItem == null ? null : mainItem.batchCode(),
                invoice.getCreatedAt(),
                confirmedReceivedAt,
                invoice.getDueDate(),
                expectedDueAt == null ? null : expectedDueAt.toLocalDate(),
                dueLabel(paymentPlan, invoice.getDueDate(), confirmedReceivedAt, expectedDueAt),
                invoice.getTotalAmount(),
                invoiceAdjustmentAmount(invoice),
                calc.remaining(),
                calc.amount(),
                calc.paid(),
                calc.remaining(),
                paymentPlan,
                paymentTermDays(invoice),
                invoiceStatus(calc),
                invoiceStatusLabel(calc),
                calc.overdueDays());
    }

    private SupplierDebtDtos.PaymentItem toPaymentItem(PaymentEntity payment, UserEntity user) {
        return new SupplierDebtDtos.PaymentItem(payment.getId(), payment.getInvoiceId(), paymentAmount(payment), payment.getPaymentDate(), payment.getPaymentMethod(), payment.getNote(), user == null ? null : firstText(user.getFullName(), user.getEmail()));
    }

    private SupplierDebtDtos.AdjustmentItem toAdjustmentItem(DebtAdjustmentEntity item) {
        return new SupplierDebtDtos.AdjustmentItem(item.getId(), item.getInvoiceId(), item.getAmount(), item.getAdjustmentType() == null ? null : item.getAdjustmentType().name(), item.getDescription(), item.getCreatedAt());
    }

    private SupplierDebtDtos.ReminderItem toReminderItem(DebtReminderEntity item, Boolean isRead) {
        InvoiceEntity invoice = item.getInvoiceId() == null ? null : invoiceRepository.findById(item.getInvoiceId()).orElse(null);
        Long orderId = item.getOrderId() == null && invoice != null ? invoice.getOrderId() : item.getOrderId();
        InvoiceItemEntity invoiceItem = item.getInvoiceId() == null ? null : invoiceItemRepository.findByInvoiceIdIn(List.of(item.getInvoiceId())).stream().findFirst().orElse(null);
        UserEntity sender = item.getCreatedByUserId() == null ? null : userRepository.findById(item.getCreatedByUserId()).orElse(null);
        LocalDateTime confirmedReceivedAt = orderId == null ? null : shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId).map(ShipmentEntity::getConfirmedReceivedAt).orElse(null);
        String plan = invoice == null ? "" : paymentPlanType(invoice);
        String status = item.getStatus() == null ? null : item.getStatus().name();
        if (Boolean.TRUE.equals(isRead) && "SENT".equals(status)) status = "READ";
        return new SupplierDebtDtos.ReminderItem(
                item.getId(),
                item.getInvoiceId(),
                invoice == null ? null : invoice.getInvoiceNumber(),
                orderId,
                orderId == null ? null : "ORD-" + orderId,
                invoiceItem == null ? null : firstText(invoiceItem.getDescription(), null),
                invoiceItem == null ? null : invoiceItem.getQuantity(),
                invoiceItem == null ? null : invoiceItem.getUnit(),
                dueLabel(plan, invoice == null ? null : invoice.getDueDate(), confirmedReceivedAt, null),
                item.getAmount(),
                item.getMessage(),
                item.getChannel(),
                status,
                sender == null ? null : firstText(sender.getFullName(), sender.getEmail()),
                item.getSentAt(),
                item.getCreatedAt());
    }

    private SupplierDebtDtos.CreditLimitItem toCreditLimitItem(CreditLimitEntity item, Long buyerId) {
        return item == null ? new SupplierDebtDtos.CreditLimitItem(null, buyerId, BigDecimal.ZERO, null, "Chưa có", null)
                : new SupplierDebtDtos.CreditLimitItem(item.getId(), item.getBuyerCompanyId(), item.getCreditLimit(), item.getPaymentTermDays(), item.getStatus() == null ? "ACTIVE" : item.getStatus().name(), item.getNote());
    }

    private InvoiceCalc calc(InvoiceEntity invoice, BigDecimal paidValue, LocalDateTime confirmedReceivedAt, OrderEntity order) {
        BigDecimal amount = invoiceAmount(invoice);
        BigDecimal paid = nullToZero(paidValue);
        if (paid.compareTo(amount) > 0) paid = amount;
        BigDecimal remaining = amount.subtract(paid).max(BigDecimal.ZERO);
        LocalDate today = LocalDate.now();
        String plan = paymentPlanType(invoice);
        LocalDate effectiveDueDate = invoice.getDueDate();
        if ("DEPOSIT_50".equals(plan) && confirmedReceivedAt != null) effectiveDueDate = confirmedReceivedAt.toLocalDate();
        boolean overdue = remaining.compareTo(BigDecimal.ZERO) > 0 && effectiveDueDate != null && effectiveDueDate.isBefore(today);
        boolean dueSoon = remaining.compareTo(BigDecimal.ZERO) > 0 && effectiveDueDate != null && !effectiveDueDate.isBefore(today) && !effectiveDueDate.isAfter(today.plusDays(7));
        return new InvoiceCalc(amount, paid, remaining, overdue, dueSoon, overdue ? ChronoUnit.DAYS.between(effectiveDueDate, today) : 0, plan);
    }

    private BigDecimal invoiceAmount(InvoiceEntity invoice) {
        BigDecimal adjusted = nullToZero(invoice.getAdjustedAmount());
        return adjusted.compareTo(BigDecimal.ZERO) > 0 ? adjusted : nullToZero(invoice.getTotalAmount());
    }

    private BigDecimal paymentAmount(PaymentEntity payment) {
        if (!isPaidPaymentStatus(payment)) return BigDecimal.ZERO;
        BigDecimal paid = nullToZero(payment.getPaidAmount());
        return paid.compareTo(BigDecimal.ZERO) > 0 ? paid : nullToZero(payment.getAmount());
    }

    private InvoiceStatusEnum resolveInvoiceStatus(InvoiceEntity invoice, BigDecimal paid) {
        BigDecimal remaining = invoiceAmount(invoice).subtract(paid);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) return InvoiceStatusEnum.PAID;
        if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now())) return InvoiceStatusEnum.OVERDUE;
        if (paid.compareTo(BigDecimal.ZERO) > 0) return InvoiceStatusEnum.PARTIAL;
        return InvoiceStatusEnum.UNPAID;
    }

    private String status(CreditLimitEntity credit, BigDecimal overdue, BigDecimal dueSoon, BigDecimal remainingCredit) {
        if (credit != null && (Boolean.TRUE.equals(credit.getIsBlocked()) || CreditLimitStatusEnum.SUSPENDED.equals(credit.getStatus()))) return "BLOCKED";
        if (credit != null && nullToZero(credit.getCreditLimit()).compareTo(BigDecimal.ZERO) > 0 && remainingCredit.compareTo(BigDecimal.ZERO) < 0) return "OVER_LIMIT";
        if (overdue.compareTo(BigDecimal.ZERO) > 0) return "OVERDUE";
        if (dueSoon.compareTo(BigDecimal.ZERO) > 0) return "DUE_SOON";
        return "NORMAL";
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "BLOCKED" -> "Bị tạm khóa công nợ";
            case "OVER_LIMIT" -> "Vượt hạn mức";
            case "OVERDUE" -> "Quá hạn";
            case "DUE_SOON" -> "Sắp đến hạn";
            default -> "Bình thường";
        };
    }

    private String invoiceStatusLabel(InvoiceCalc calc) {
        if (calc.remaining().compareTo(BigDecimal.ZERO) <= 0) return "Đã thanh toán";
        if (calc.overdue()) return "Quá hạn";
        if (calc.dueSoon()) return "Đến hạn thanh toán";
        if ("DEPOSIT_50".equals(calc.paymentPlanType()) && calc.paid().compareTo(BigDecimal.ZERO) > 0) return "Đã cọc 50%";
        if (calc.paid().compareTo(BigDecimal.ZERO) > 0) return "Thanh toán một phần";
        return "Chưa thanh toán";
    }

    private CreditLimitStatusEnum parseCreditStatus(String value) {
        if (value == null || value.isBlank()) return CreditLimitStatusEnum.ACTIVE;
        return CreditLimitStatusEnum.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    private AdjustmentTypeEnum parseAdjustmentType(String value) {
        if (value == null || value.isBlank()) return AdjustmentTypeEnum.OTHER;
        return AdjustmentTypeEnum.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    private String formatMoney(BigDecimal value) {
        return NumberFormat.getNumberInstance(new Locale("vi", "VN")).format(nullToZero(value).setScale(0, RoundingMode.HALF_UP)) + "đ";
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String firstText(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first.trim();
    }

    private String json(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String formatQuantity(BigDecimal quantity, String unit) {
        BigDecimal safe = nullToZero(quantity).stripTrailingZeros();
        String number = safe.scale() <= 0 ? safe.toPlainString() : safe.toPlainString();
        return number + firstText(unit, "");
    }

    private String dueLabel(String paymentPlan, LocalDate dueDate, LocalDateTime confirmedReceivedAt, LocalDateTime expectedDueAt) {
        if ("DEPOSIT_50".equalsIgnoreCase(paymentPlan)) {
            if (confirmedReceivedAt == null) {
                return "Khi nhận hàng";
            }
            return confirmedReceivedAt.toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        }
        if ("PREPAID".equalsIgnoreCase(paymentPlan)) return "Ngay khi đặt hàng";
        if (dueDate == null) return "Chưa xác định";
        return dueDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String paymentPlanType(InvoiceEntity invoice) {
        String method = firstText(invoice.getPaymentMethod(), "");
        if ("DEPOSIT_50".equalsIgnoreCase(method)) return "DEPOSIT_50";
        if ("CREDIT".equalsIgnoreCase(method) || "DEBT".equalsIgnoreCase(method)) return "CREDIT_TERM";
        return "PREPAID";
    }

    private Integer paymentTermDays(InvoiceEntity invoice) {
        if (invoice.getDueDate() == null || invoice.getCreatedAt() == null) return null;
        return (int) ChronoUnit.DAYS.between(invoice.getCreatedAt().toLocalDate(), invoice.getDueDate());
    }

    private BigDecimal invoiceAdjustmentAmount(InvoiceEntity invoice) {
        return nullToZero(invoice.getTotalAmount()).subtract(invoiceAmount(invoice));
    }

    private String displayInvoiceCode(InvoiceEntity invoice) {
        return invoice == null || invoice.getOrderId() == null ? firstText(invoice == null ? null : invoice.getInvoiceNumber(), null) : "INV-" + invoice.getOrderId();
    }

    private InvoiceLine toInvoiceLine(InvoiceItemEntity item, InvoiceLine orderLine, Map<Long, ProductEntity> productsById) {
        if (item == null) return orderLine;
        ProductEntity product = item.getProductId() == null ? null : productsById.get(item.getProductId());
        return new InvoiceLine(
                firstText(firstText(item.getDescription(), null), orderLine == null ? product == null ? null : product.getName() : orderLine.productName()),
                item.getQuantity(),
                firstText(item.getUnit(), orderLine == null ? product == null ? null : product.getUnit() : orderLine.unit()),
                orderLine == null ? null : orderLine.batchCode());
    }

    private InvoiceLine toInvoiceLine(OrderItemEntity item, Map<Long, ProductEntity> productsById, Map<Long, BatchEntity> batchesById) {
        if (item == null) return null;
        ProductEntity product = item.getProductId() == null ? null : productsById.get(item.getProductId());
        BatchEntity batch = item.getBatchId() == null ? null : batchesById.get(item.getBatchId());
        if (product == null && batch != null && batch.getProductId() != null) {
            product = productsById.get(batch.getProductId());
        }
        return new InvoiceLine(
                product == null ? null : product.getName(),
                item.getQuantity(),
                firstText(item.getUnit(), product == null ? null : product.getUnit()),
                batch == null ? null : batchCode(batch.getId()));
    }

    private String batchCode(Long id) {
        return id == null ? null : "LOT-" + String.format("%06d", id);
    }

    private String invoiceStatus(InvoiceCalc calc) {
        if (calc.remaining().compareTo(BigDecimal.ZERO) <= 0) return "PAID";
        if (calc.overdue()) return "OVERDUE";
        if (calc.dueSoon()) return "DUE_NOW";
        if ("DEPOSIT_50".equals(calc.paymentPlanType()) && calc.paid().compareTo(BigDecimal.ZERO) > 0) return "PARTIAL";
        if (calc.paid().compareTo(BigDecimal.ZERO) > 0) return "PARTIAL";
        return "UNPAID";
    }

    private boolean isPaidPaymentStatus(PaymentEntity payment) {
        if (payment == null || payment.getStatus() == null) return false;
        String status = payment.getStatus().trim().toUpperCase(Locale.ROOT);
        return List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(status);
    }

    private Map<Long, BigDecimal> buildPaidByInvoice(List<PaymentEntity> payments, List<PaymentAllocationEntity> allocations, Map<Long, PaymentEntity> paymentsById) {
        Map<Long, BigDecimal> paidByInvoice = new java.util.HashMap<>();
        Map<Long, BigDecimal> allocatedByPaymentId = allocations.stream()
                .collect(Collectors.groupingBy(PaymentAllocationEntity::getPaymentId, Collectors.mapping(PaymentAllocationEntity::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        allocations.stream()
                .filter(allocation -> {
                    PaymentEntity payment = paymentsById.get(allocation.getPaymentId());
                    return isPaidPaymentStatus(payment);
                })
                .forEach(allocation -> paidByInvoice.merge(allocation.getInvoiceId(), nullToZero(allocation.getAmount()), BigDecimal::add));

        payments.stream()
                .filter(this::isPaidPaymentStatus)
                .filter(payment -> payment.getInvoiceId() != null)
                .filter(payment -> nullToZero(allocatedByPaymentId.get(payment.getId())).compareTo(BigDecimal.ZERO) <= 0)
                .forEach(payment -> paidByInvoice.merge(payment.getInvoiceId(), paymentAmount(payment), BigDecimal::add));
        return paidByInvoice;
    }

    private record DebtContext(
            Long supplierCompanyId,
            List<OrderEntity> orders,
            List<InvoiceEntity> invoices,
            List<PaymentEntity> payments,
            List<DebtAdjustmentEntity> adjustments,
            List<DebtReminderEntity> reminders,
            Map<Long, BigDecimal> paidByInvoice,
            Map<Long, CompanyEntity> buyersById,
            Map<Long, CreditLimitEntity> creditByBuyer,
            Map<Long, UserEntity> usersById,
            Map<Long, OrderEntity> ordersById,
            Map<Long, InvoiceLine> invoiceMainItemByInvoiceId,
            Map<Long, LocalDateTime> confirmedReceivedAtByOrderId,
            Map<Long, LocalDateTime> expectedDeliveryAtByOrderId
    ) {
    }

    private record InvoiceCalc(BigDecimal amount, BigDecimal paid, BigDecimal remaining, boolean overdue, boolean dueSoon, long overdueDays, String paymentPlanType) {
    }

    private record InvoiceLine(String productName, BigDecimal quantity, String unit, String batchCode) {
    }
}


