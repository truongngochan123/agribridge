package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerDebtDtos;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CreditLimitEntity;
import com.agribridge.backend.entity.DebtAdjustmentEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.CreditLimitRepository;
import com.agribridge.backend.repository.DebtAdjustmentRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.BuyerDebtService;
import com.agribridge.backend.service.CurrentUserService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
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
public class BuyerDebtServiceImpl implements BuyerDebtService {

    private static final List<OrderStatusEnum> EXCLUDED_ORDER_STATUSES = List.of(OrderStatusEnum.CANCELLED);

    private final CurrentUserService currentUserService;
    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final DebtAdjustmentRepository debtAdjustmentRepository;
    private final CreditLimitRepository creditLimitRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public BuyerDebtDtos.Overview getDebts() {
        DebtContext context = loadContext();
        return new BuyerDebtDtos.Overview(buildKpis(context), buildSupplierRows(context));
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerDebtDtos.SupplierDetail getSupplierDetail(Long supplierId) {
        if (supplierId == null) throw new IllegalArgumentException("supplierId is required");
        DebtContext context = loadContext();
        List<BuyerDebtDtos.SupplierDebt> supplierRows = buildSupplierRows(context);
        BuyerDebtDtos.SupplierDebt summary = supplierRows.stream()
                .filter(item -> Objects.equals(item.supplierId(), supplierId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("SUPPLIER_DEBT_NOT_FOUND"));
        List<InvoiceEntity> invoices = context.invoices().stream()
                .filter(invoice -> {
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    return order != null && Objects.equals(order.getSupplierCompanyId(), supplierId);
                })
                .sorted(Comparator.comparing(InvoiceEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<BuyerDebtDtos.InvoiceItem> invoiceItems = invoices.stream().map(invoice -> toInvoiceItem(invoice, context.paidByInvoice().get(invoice.getId()))).toList();
        List<BuyerDebtDtos.PaymentItem> payments = context.payments().stream()
                .filter(payment -> invoiceIds.contains(payment.getInvoiceId()))
                .sorted(Comparator.comparing(PaymentEntity::getPaymentDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(payment -> toPaymentItem(payment, context.usersById().get(payment.getConfirmedByUserId())))
                .toList();
        List<BuyerDebtDtos.AdjustmentItem> adjustments = context.adjustments().stream()
                .filter(adjustment -> invoiceIds.contains(adjustment.getInvoiceId()))
                .map(this::toAdjustmentItem)
                .toList();
        return new BuyerDebtDtos.SupplierDetail(summary, invoiceItems, payments, adjustments);
    }

    @Override
    @Transactional
    public BuyerDebtDtos.PaymentResponse createPayment(BuyerDebtDtos.PaymentRequest request) {
        UserEntity user = currentUserService.requireCurrentUser();
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        if (request == null || request.invoiceId() == null) throw new IllegalArgumentException("invoiceId is required");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("amount must be greater than 0");
        if (request.paymentMethod() == null || request.paymentMethod().isBlank()) throw new IllegalArgumentException("paymentMethod is required");
        LocalDateTime paymentDate = request.paymentDate() == null ? LocalDateTime.now() : request.paymentDate();
        if (paymentDate.isAfter(LocalDateTime.now().plusDays(1))) throw new IllegalArgumentException("paymentDate is too far in the future");

        InvoiceEntity invoice = invoiceRepository.findById(request.invoiceId()).orElseThrow(() -> new IllegalArgumentException("INVOICE_NOT_FOUND"));
        OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        if (!Objects.equals(order.getBuyerCompanyId(), buyerCompanyId)) throw new IllegalArgumentException("INVOICE_NOT_BELONG_TO_BUYER");
        if (OrderStatusEnum.CANCELLED.equals(order.getStatus())) throw new IllegalArgumentException("ORDER_CANCELLED");
        if (InvoiceStatusEnum.PAID.equals(invoice.getStatus())) throw new IllegalArgumentException("INVOICE_ALREADY_PAID");

        BigDecimal paid = paidAmount(paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoice.getId()));
        BigDecimal remaining = invoiceAmount(invoice).subtract(paid);
        if (request.amount().compareTo(remaining) > 0) throw new IllegalArgumentException("amount exceeds remainingAmount");

        PaymentEntity payment = PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .amount(request.amount())
                .paidAmount(request.amount())
                .paymentMethod(request.paymentMethod().trim())
                .paymentType("BUYER_DEBT_PAYMENT")
                .status("PAID")
                .escrowStatus("CONFIRMED")
                .dueDate(invoice.getDueDate())
                .paymentDate(paymentDate)
                .confirmedByUserId(user.getId())
                .note(clean(request.note()))
                .build();
        PaymentEntity savedPayment = paymentRepository.save(payment);
        BigDecimal paidAfter = paid.add(request.amount());
        BigDecimal remainingAfter = invoiceAmount(invoice).subtract(paidAfter);
        invoice.setStatus(resolveInvoiceStatus(invoice, paidAfter, remainingAfter));
        invoiceRepository.save(invoice);
        return new BuyerDebtDtos.PaymentResponse(toInvoiceItem(invoice, paidAfter), toPaymentItem(savedPayment, user));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BuyerDebtDtos.PaymentItem> getInvoicePayments(Long invoiceId) {
        if (invoiceId == null) throw new IllegalArgumentException("invoiceId is required");
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        InvoiceEntity invoice = invoiceRepository.findById(invoiceId).orElseThrow(() -> new IllegalArgumentException("INVOICE_NOT_FOUND"));
        OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        if (!Objects.equals(order.getBuyerCompanyId(), buyerCompanyId)) throw new IllegalArgumentException("INVOICE_NOT_BELONG_TO_BUYER");
        List<PaymentEntity> payments = paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoiceId);
        Map<Long, UserEntity> users = userMap(payments.stream().map(PaymentEntity::getConfirmedByUserId).filter(Objects::nonNull).toList());
        return payments.stream().map(payment -> toPaymentItem(payment, users.get(payment.getConfirmedByUserId()))).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportCsv(Long supplierId, String status, LocalDate fromDate, LocalDate toDate) {
        DebtContext context = loadContext();
        Map<Long, BuyerDebtDtos.SupplierDebt> supplierRows = buildSupplierRows(context).stream()
                .collect(Collectors.toMap(BuyerDebtDtos.SupplierDebt::supplierId, Function.identity()));
        StringBuilder csv = new StringBuilder("\uFEFFsupplier,invoice,order,due_date,status,total,paid,remaining,overdue\n");
        context.invoices().stream()
                .filter(invoice -> supplierId == null || Objects.equals(context.ordersById().get(invoice.getOrderId()).getSupplierCompanyId(), supplierId))
                .filter(invoice -> fromDate == null || invoice.getCreatedAt() == null || !invoice.getCreatedAt().toLocalDate().isBefore(fromDate))
                .filter(invoice -> toDate == null || invoice.getCreatedAt() == null || !invoice.getCreatedAt().toLocalDate().isAfter(toDate))
                .filter(invoice -> {
                    if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) return true;
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    BuyerDebtDtos.SupplierDebt row = order == null ? null : supplierRows.get(order.getSupplierCompanyId());
                    return row != null && status.equalsIgnoreCase(row.status());
                })
                .forEach(invoice -> {
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    CompanyEntity supplier = order == null ? null : context.suppliersById().get(order.getSupplierCompanyId());
                    BuyerDebtDtos.InvoiceItem item = toInvoiceItem(invoice, context.paidByInvoice().get(invoice.getId()));
                    csv.append(csv(supplier == null ? "N/A" : supplier.getName())).append(',')
                            .append(csv(item.invoiceNumber())).append(',')
                            .append(csv(item.orderRef())).append(',')
                            .append(csv(item.dueDate() == null ? "" : item.dueDate().toString())).append(',')
                            .append(csv(item.statusLabel())).append(',')
                            .append(item.adjustedAmount()).append(',')
                            .append(item.paidAmount()).append(',')
                            .append(item.remainingAmount()).append(',')
                            .append(item.overdueDays()).append('\n');
                });
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private DebtContext loadContext() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        List<OrderEntity> orders = orderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(buyerCompanyId).stream()
                .filter(order -> !EXCLUDED_ORDER_STATUSES.contains(order.getStatus()))
                .toList();
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();
        List<InvoiceEntity> invoices = orderIds.isEmpty() ? List.of() : invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        List<DebtAdjustmentEntity> adjustments = invoiceIds.isEmpty() ? List.of() : debtAdjustmentRepository.findByInvoiceIdInOrderByCreatedAtDesc(invoiceIds);
        Map<Long, OrderEntity> ordersById = orders.stream().collect(Collectors.toMap(OrderEntity::getId, Function.identity()));
        Map<Long, BigDecimal> paidByInvoice = payments.stream().collect(Collectors.groupingBy(PaymentEntity::getInvoiceId, Collectors.mapping(this::paymentAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
        List<Long> supplierIds = orders.stream().map(OrderEntity::getSupplierCompanyId).filter(Objects::nonNull).distinct().toList();
        Map<Long, CompanyEntity> suppliersById = supplierIds.isEmpty() ? Map.of() : companyRepository.findAllById(supplierIds).stream().collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
        Map<Long, CreditLimitEntity> creditBySupplier = supplierIds.isEmpty() ? Map.of() : creditLimitRepository.findByBuyerCompanyIdAndSupplierCompanyIdIn(buyerCompanyId, supplierIds).stream().collect(Collectors.toMap(CreditLimitEntity::getSupplierCompanyId, Function.identity()));
        Map<Long, UserEntity> usersById = userMap(payments.stream().map(PaymentEntity::getConfirmedByUserId).filter(Objects::nonNull).toList());
        return new DebtContext(buyerCompanyId, orders, invoices, payments, adjustments, ordersById, paidByInvoice, suppliersById, creditBySupplier, usersById);
    }

    private List<BuyerDebtDtos.Kpi> buildKpis(DebtContext context) {
        List<InvoiceCalc> invoices = context.invoices().stream().map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()))).toList();
        BigDecimal totalDebt = invoices.stream().map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdueDebt = invoices.stream().filter(InvoiceCalc::overdue).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate today = LocalDate.now();
        BigDecimal paidThisMonth = context.payments().stream()
                .filter(payment -> payment.getPaymentDate() != null && payment.getPaymentDate().getYear() == today.getYear() && payment.getPaymentDate().getMonth() == today.getMonth())
                .map(this::paymentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal dueSoon = invoices.stream().filter(InvoiceCalc::dueSoon).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        long unpaidCount = invoices.stream().filter(item -> item.remaining().compareTo(BigDecimal.ZERO) > 0).count();
        long overdueCount = invoices.stream().filter(InvoiceCalc::overdue).count();
        return List.of(
                new BuyerDebtDtos.Kpi("totalDebt", "Tong phai tra", totalDebt, formatMoney(totalDebt)),
                new BuyerDebtDtos.Kpi("overdueDebt", "Qua han", overdueDebt, formatMoney(overdueDebt)),
                new BuyerDebtDtos.Kpi("paidThisMonth", "Da thanh toan thang", paidThisMonth, formatMoney(paidThisMonth)),
                new BuyerDebtDtos.Kpi("dueSoon", "Sap den han", dueSoon, formatMoney(dueSoon)),
                new BuyerDebtDtos.Kpi("unpaidInvoiceCount", "Hoa don chua tat toan", BigDecimal.valueOf(unpaidCount), String.valueOf(unpaidCount)),
                new BuyerDebtDtos.Kpi("overdueInvoiceCount", "Hoa don qua han", BigDecimal.valueOf(overdueCount), String.valueOf(overdueCount)));
    }

    private List<BuyerDebtDtos.SupplierDebt> buildSupplierRows(DebtContext context) {
        return context.orders().stream()
                .map(OrderEntity::getSupplierCompanyId)
                .filter(Objects::nonNull)
                .distinct()
                .map(supplierId -> buildSupplierRow(supplierId, context))
                .sorted(Comparator.comparing(BuyerDebtDtos.SupplierDebt::remainingAmount, Comparator.reverseOrder()))
                .toList();
    }

    private BuyerDebtDtos.SupplierDebt buildSupplierRow(Long supplierId, DebtContext context) {
        List<InvoiceEntity> invoices = context.invoices().stream()
                .filter(invoice -> {
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    return order != null && Objects.equals(order.getSupplierCompanyId(), supplierId);
                })
                .toList();
        List<InvoiceCalc> calcs = invoices.stream().map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()))).toList();
        BigDecimal total = calcs.stream().map(InvoiceCalc::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = calcs.stream().map(InvoiceCalc::paid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = calcs.stream().map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdue = calcs.stream().filter(InvoiceCalc::overdue).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal dueSoon = calcs.stream().filter(InvoiceCalc::dueSoon).map(InvoiceCalc::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
        long unpaidCount = calcs.stream().filter(item -> item.remaining().compareTo(BigDecimal.ZERO) > 0).count();
        long overdueCount = calcs.stream().filter(InvoiceCalc::overdue).count();
        long dueSoonCount = calcs.stream().filter(InvoiceCalc::dueSoon).count();
        CreditLimitEntity credit = context.creditBySupplier().get(supplierId);
        BigDecimal limit = credit == null ? BigDecimal.ZERO : nullToZero(credit.getCreditLimit());
        BigDecimal usage = limit.compareTo(BigDecimal.ZERO) > 0 ? remaining.multiply(BigDecimal.valueOf(100)).divide(limit, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        String status = status(Boolean.TRUE.equals(credit == null ? null : credit.getIsBlocked()), overdue, usage, dueSoon);
        CompanyEntity supplier = context.suppliersById().get(supplierId);
        return new BuyerDebtDtos.SupplierDebt(
                supplierId,
                supplier == null ? "N/A" : supplier.getName(),
                invoices.size(),
                (int) unpaidCount,
                (int) overdueCount,
                total,
                paid,
                remaining,
                overdue,
                dueSoon,
                (int) dueSoonCount,
                limit,
                credit == null ? null : credit.getPaymentTermDays(),
                usage,
                credit != null && Boolean.TRUE.equals(credit.getIsBlocked()),
                credit == null ? null : credit.getBlockedReason(),
                status,
                statusLabel(status));
    }

    private BuyerDebtDtos.InvoiceItem toInvoiceItem(InvoiceEntity invoice, BigDecimal paidValue) {
        InvoiceCalc calc = calc(invoice, paidValue);
        return new BuyerDebtDtos.InvoiceItem(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                invoice.getOrderId(),
                orderCode(invoice.getOrderId()),
                invoice.getCreatedAt(),
                invoice.getDueDate(),
                invoice.getTotalAmount(),
                calc.amount(),
                calc.paid(),
                calc.remaining(),
                invoice.getStatus() == null ? null : invoice.getStatus().name(),
                invoiceStatusLabel(invoice, calc),
                calc.overdueDays());
    }

    private BuyerDebtDtos.PaymentItem toPaymentItem(PaymentEntity payment, UserEntity user) {
        return new BuyerDebtDtos.PaymentItem(
                payment.getId(),
                payment.getInvoiceId(),
                paymentAmount(payment),
                payment.getPaymentDate(),
                payment.getPaymentMethod(),
                payment.getNote(),
                user == null ? null : firstText(user.getFullName(), firstText(user.getEmail(), user.getPhone())));
    }

    private BuyerDebtDtos.AdjustmentItem toAdjustmentItem(DebtAdjustmentEntity adjustment) {
        return new BuyerDebtDtos.AdjustmentItem(
                adjustment.getId(),
                adjustment.getInvoiceId(),
                adjustment.getAmount(),
                adjustment.getAdjustmentType() == null ? null : adjustment.getAdjustmentType().name(),
                adjustment.getDescription(),
                adjustment.getCreatedAt());
    }

    private InvoiceCalc calc(InvoiceEntity invoice, BigDecimal paidValue) {
        BigDecimal amount = invoiceAmount(invoice);
        BigDecimal paid = nullToZero(paidValue);
        BigDecimal remaining = amount.subtract(paid);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) remaining = BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        boolean overdue = remaining.compareTo(BigDecimal.ZERO) > 0 && invoice.getDueDate() != null && invoice.getDueDate().isBefore(today);
        boolean dueSoon = remaining.compareTo(BigDecimal.ZERO) > 0 && invoice.getDueDate() != null && !invoice.getDueDate().isBefore(today) && !invoice.getDueDate().isAfter(today.plusDays(7));
        long overdueDays = overdue ? ChronoUnit.DAYS.between(invoice.getDueDate(), today) : 0;
        return new InvoiceCalc(amount, paid, remaining, overdue, dueSoon, overdueDays);
    }

    private BigDecimal invoiceAmount(InvoiceEntity invoice) {
        BigDecimal adjusted = nullToZero(invoice.getAdjustedAmount());
        return adjusted.compareTo(BigDecimal.ZERO) > 0 ? adjusted : nullToZero(invoice.getTotalAmount());
    }

    private BigDecimal paidAmount(Collection<PaymentEntity> payments) {
        return payments.stream().map(this::paymentAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal paymentAmount(PaymentEntity payment) {
        return nullToZero(payment.getAmount());
    }

    private InvoiceStatusEnum resolveInvoiceStatus(InvoiceEntity invoice, BigDecimal paid, BigDecimal remaining) {
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) return InvoiceStatusEnum.PAID;
        if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now())) return InvoiceStatusEnum.OVERDUE;
        if (paid.compareTo(BigDecimal.ZERO) > 0) return InvoiceStatusEnum.PARTIAL;
        return InvoiceStatusEnum.UNPAID;
    }

    private String status(boolean blocked, BigDecimal overdue, BigDecimal usage, BigDecimal dueSoon) {
        if (blocked) return "BLOCKED";
        if (overdue.compareTo(BigDecimal.ZERO) > 0) return "OVERDUE";
        if (usage.compareTo(BigDecimal.valueOf(80)) >= 0 || dueSoon.compareTo(BigDecimal.ZERO) > 0) return "WARNING";
        return "NORMAL";
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "BLOCKED" -> "Bi chan";
            case "OVERDUE" -> "Qua han";
            case "WARNING" -> "Canh bao";
            default -> "Binh thuong";
        };
    }

    private String invoiceStatusLabel(InvoiceEntity invoice, InvoiceCalc calc) {
        if (calc.remaining().compareTo(BigDecimal.ZERO) <= 0) return "Da thanh toan";
        if (calc.overdue()) return "Qua han";
        if (calc.paid().compareTo(BigDecimal.ZERO) > 0) return "Thanh toan mot phan";
        if (calc.dueSoon()) return "Sap den han";
        return invoice.getStatus() == null ? "Chua thanh toan" : invoice.getStatus().name();
    }

    private Map<Long, UserEntity> userMap(Collection<Long> ids) {
        List<Long> cleanIds = ids.stream().filter(Objects::nonNull).distinct().toList();
        return cleanIds.isEmpty() ? Map.of() : userRepository.findAllById(cleanIds).stream().collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private String formatMoney(BigDecimal value) {
        return NumberFormat.getNumberInstance(new Locale("vi", "VN")).format(nullToZero(value)) + "d";
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String firstText(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first.trim();
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String orderCode(Long id) {
        return id == null ? "ORD-N/A" : "ORD-" + id;
    }

    private String csv(String value) {
        String escaped = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }

    private record DebtContext(
            Long buyerCompanyId,
            List<OrderEntity> orders,
            List<InvoiceEntity> invoices,
            List<PaymentEntity> payments,
            List<DebtAdjustmentEntity> adjustments,
            Map<Long, OrderEntity> ordersById,
            Map<Long, BigDecimal> paidByInvoice,
            Map<Long, CompanyEntity> suppliersById,
            Map<Long, CreditLimitEntity> creditBySupplier,
            Map<Long, UserEntity> usersById
    ) {
    }

    private record InvoiceCalc(BigDecimal amount, BigDecimal paid, BigDecimal remaining, boolean overdue, boolean dueSoon, long overdueDays) {
    }
}
