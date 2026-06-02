package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerDebtDtos;
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
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.PaymentAllocationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.CreditLimitRepository;
import com.agribridge.backend.repository.DebtAdjustmentRepository;
import com.agribridge.backend.repository.DebtReminderRepository;
import com.agribridge.backend.repository.BatchRepository;
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
import com.agribridge.backend.service.BuyerDebtService;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.NotificationCenterService;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class BuyerDebtServiceImpl implements BuyerDebtService {

    private static final List<OrderStatusEnum> EXCLUDED_ORDER_STATUSES = List.of(OrderStatusEnum.CANCELLED);

    private final CurrentUserService currentUserService;
    private final OrderRepository orderRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final DebtAdjustmentRepository debtAdjustmentRepository;
    private final DebtReminderRepository debtReminderRepository;
    private final CreditLimitRepository creditLimitRepository;
    private final CompanyRepository companyRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final ShipmentRepository shipmentRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationCenterService notificationCenterService;

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
        List<BuyerDebtDtos.InvoiceItem> invoiceItems = invoices.stream().map(invoice -> toInvoiceItem(invoice, context)).toList();
        List<BuyerDebtDtos.PaymentItem> payments = context.payments().stream()
                .filter(payment -> invoiceIds.contains(payment.getInvoiceId()))
                .sorted(Comparator.comparing(PaymentEntity::getPaymentDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(payment -> {
                    Long confirmedByUserId = payment.getConfirmedByUserId();
                    UserEntity confirmedBy = confirmedByUserId == null ? null : context.usersById().get(confirmedByUserId);
                    return toPaymentItem(payment, confirmedBy);
                })
                .toList();
        List<BuyerDebtDtos.AdjustmentItem> adjustments = context.adjustments().stream()
                .filter(adjustment -> invoiceIds.contains(adjustment.getInvoiceId()))
                .map(this::toAdjustmentItem)
                .toList();
        List<DebtReminderEntity> supplierReminders = context.reminders().stream()
                .filter(reminder -> reminder.getInvoiceId() == null || invoiceIds.contains(reminder.getInvoiceId()))
                .toList();
        Map<Long, Boolean> reminderReadState = supplierReminders.isEmpty()
                ? Map.of()
                : notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefIdIn(
                                context.buyerCompanyId(),
                                NotificationTypeEnum.DEBT_REMINDER,
                                "debt_reminders",
                                supplierReminders.stream().map(DebtReminderEntity::getId).toList())
                        .stream()
                        .collect(Collectors.toMap(NotificationEntity::getRefId, item -> Boolean.TRUE.equals(item.getIsRead()), (a, b) -> a || b));
        List<BuyerDebtDtos.ReminderItem> reminders = context.reminders().stream()
                .filter(reminder -> reminder.getInvoiceId() == null || invoiceIds.contains(reminder.getInvoiceId()))
                .map(reminder -> toReminderItem(reminder, reminderReadState.get(reminder.getId())))
                .toList();
        return new BuyerDebtDtos.SupplierDetail(summary, invoiceItems, payments, adjustments, reminders);
    }

    @Override
    @Transactional
    public BuyerDebtDtos.PaymentResponse createPayment(BuyerDebtDtos.PaymentRequest request) {
        UserEntity user = currentUserService.requireCurrentUser();
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        if (request == null || request.invoiceId() == null) throw new IllegalArgumentException("Không tìm thấy hóa đơn.");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Số tiền thanh toán không hợp lệ.");
        if (request.paymentMethod() == null || request.paymentMethod().isBlank()) throw new IllegalArgumentException("paymentMethod is required");
        LocalDateTime paymentDate = request.paymentDate() == null ? LocalDateTime.now() : request.paymentDate();
        if (paymentDate.isAfter(LocalDateTime.now().plusDays(1))) throw new IllegalArgumentException("paymentDate is too far in the future");

        InvoiceEntity invoice = invoiceRepository.findById(request.invoiceId()).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hóa đơn."));
        OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        if (!Objects.equals(order.getBuyerCompanyId(), buyerCompanyId)) throw new IllegalArgumentException("INVOICE_NOT_BELONG_TO_BUYER");
        if (OrderStatusEnum.CANCELLED.equals(order.getStatus())) throw new IllegalArgumentException("ORDER_CANCELLED");
        if (InvoiceStatusEnum.PAID.equals(invoice.getStatus())) throw new IllegalArgumentException("Hóa đơn đã được thanh toán.");

        BigDecimal paid = paidAmount(paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoice.getId()));
        BigDecimal remaining = invoiceAmount(invoice).subtract(paid);
        if (request.amount().compareTo(remaining) > 0) throw new IllegalArgumentException("Số tiền thanh toán vượt quá số còn lại.");
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Hóa đơn đã được thanh toán.");
        LocalDateTime now = LocalDateTime.now();

        PaymentEntity payment = PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order.getId())
                .buyerCompanyId(buyerCompanyId)
                .amount(request.amount())
                .paidAmount(request.amount())
                .paymentMethod(request.paymentMethod().trim())
                .paymentType("BUYER_DEBT_PAYMENT")
                .status("PAID")
                .escrowStatus("CONFIRMED")
                .dueDate(invoice.getDueDate())
                .transferContent("AGRI-DEBT-" + invoice.getInvoiceNumber())
                .paidAt(paymentDate)
                .verifiedAt(now)
                .paymentDate(paymentDate)
                .createdAt(now)
                .updatedAt(now)
                .confirmedByUserId(user.getId())
                .note(clean(request.note()))
                .build();
        PaymentEntity savedPayment = paymentRepository.save(payment);
        paymentAllocationRepository.save(PaymentAllocationEntity.builder()
                .paymentId(savedPayment.getId())
                .invoiceId(invoice.getId())
                .amount(request.amount())
                .createdAt(LocalDateTime.now())
                .build());
        BigDecimal paidAfter = paid.add(request.amount());
        BigDecimal remainingAfter = invoiceAmount(invoice).subtract(paidAfter);
        invoice.setStatus(resolveInvoiceStatus(invoice, paidAfter, remainingAfter));
        invoiceRepository.save(invoice);
        if (remainingAfter.compareTo(BigDecimal.ZERO) <= 0) {
            notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefId(
                            buyerCompanyId,
                            NotificationTypeEnum.PAYMENT_DUE,
                            "invoices",
                            invoice.getId())
                    .forEach(notification -> {
                        notification.setIsRead(Boolean.TRUE);
                        notificationRepository.save(notification);
                    });
        }
        createSupplierPaymentNotification(invoice, order, request.amount(), paymentDate);
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
        return payments.stream().map(payment -> {
            Long confirmedByUserId = payment.getConfirmedByUserId();
            UserEntity confirmedBy = confirmedByUserId == null ? null : users.get(confirmedByUserId);
            return toPaymentItem(payment, confirmedBy);
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportExcel(Long supplierId, String status, LocalDate fromDate, LocalDate toDate) {
        DebtContext context = loadContext();
        Map<Long, BuyerDebtDtos.SupplierDebt> supplierRows = buildSupplierRows(context).stream()
                .collect(Collectors.toMap(BuyerDebtDtos.SupplierDebt::supplierId, Function.identity()));
        List<DebtExportRow> rows = context.invoices().stream()
                .filter(invoice -> supplierId == null || Objects.equals(context.ordersById().get(invoice.getOrderId()).getSupplierCompanyId(), supplierId))
                .filter(invoice -> fromDate == null || invoice.getCreatedAt() == null || !invoice.getCreatedAt().toLocalDate().isBefore(fromDate))
                .filter(invoice -> toDate == null || invoice.getCreatedAt() == null || !invoice.getCreatedAt().toLocalDate().isAfter(toDate))
                .filter(invoice -> {
                    if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) return true;
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    BuyerDebtDtos.SupplierDebt row = order == null ? null : supplierRows.get(order.getSupplierCompanyId());
                    return row != null && status.equalsIgnoreCase(row.status());
                })
                .map(invoice -> {
                    OrderEntity order = context.ordersById().get(invoice.getOrderId());
                    CompanyEntity supplier = order == null ? null : context.suppliersById().get(order.getSupplierCompanyId());
                    BuyerDebtDtos.InvoiceItem item = toInvoiceItem(invoice, context);
                    return new DebtExportRow(
                            supplier == null ? "N/A" : supplier.getName(),
                            item.invoiceNumber(),
                            item.orderRef(),
                            firstText(item.productName(), ""),
                            item.quantity(),
                            item.unit(),
                            item.createdAt() == null ? null : item.createdAt().toLocalDate(),
                            item.dueDate(),
                            item.statusLabel(),
                            item.adjustedAmount(),
                            item.paidAmount(),
                            item.remainingAmount(),
                            item.overdueDays());
                })
                .toList();
        return buildDebtWorkbook(rows, supplierId, status, fromDate, toDate);
    }

    private byte[] buildDebtWorkbook(List<DebtExportRow> rows, Long supplierId, String status, LocalDate fromDate, LocalDate toDate) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(output)) {
                writeZipEntry(zip, "[Content_Types].xml", contentTypesXml());
                writeZipEntry(zip, "_rels/.rels", rootRelsXml());
                writeZipEntry(zip, "xl/workbook.xml", workbookXml());
                writeZipEntry(zip, "xl/_rels/workbook.xml.rels", workbookRelsXml());
                writeZipEntry(zip, "xl/styles.xml", stylesXml());
                writeZipEntry(zip, "xl/worksheets/sheet1.xml", debtSheetXml(rows, supplierId, status, fromDate, toDate));
            }
            return output.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("Cannot build debt Excel report", error);
        }
    }

    private String debtSheetXml(List<DebtExportRow> rows, Long supplierId, String status, LocalDate fromDate, LocalDate toDate) {
        StringBuilder xml = new StringBuilder();
        BigDecimal totalAmount = rows.stream().map(DebtExportRow::total).map(this::nullToZero).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidAmount = rows.stream().map(DebtExportRow::paid).map(this::nullToZero).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remainingAmount = rows.stream().map(DebtExportRow::remaining).map(this::nullToZero).reduce(BigDecimal.ZERO, BigDecimal::add);
        long overdueCount = rows.stream().filter(row -> row.overdueDays() != null && row.overdueDays() > 0).count();
        int lastRow = rows.isEmpty() ? 7 : rows.size() + 6;

        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        xml.append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">");
        xml.append("<dimension ref=\"A1:M").append(Math.max(lastRow, 7)).append("\"/>");
        xml.append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"6\" topLeftCell=\"A7\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>");
        xml.append("<cols>");
        int[] widths = {24, 18, 14, 28, 12, 10, 14, 14, 20, 16, 16, 16, 12};
        for (int i = 0; i < widths.length; i++) {
            xml.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"").append(widths[i]).append("\" customWidth=\"1\"/>");
        }
        xml.append("</cols>");
        xml.append("<sheetData>");
        appendRow(xml, 1, List.of(textCell("A", 1, "\u0041\u0067\u0072\u0069\u0042\u0072\u0069\u0064\u0067\u0065 - B\u00e1o c\u00e1o c\u00f4ng n\u1ee3 ph\u1ea3i tr\u1ea3", 1)));
        appendRow(xml, 2, List.of(textCell("A", 2, "Th\u1eddi gian xu\u1ea5t: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), 2)));
        appendRow(xml, 3, List.of(textCell("A", 3, exportFilterText(supplierId, status, fromDate, toDate), 2)));
        appendRow(xml, 4, List.of(
                textCell("A", 4, "T\u1ed5ng h\u00f3a \u0111\u01a1n", 3), numberCell("B", 4, BigDecimal.valueOf(rows.size()), 3),
                textCell("D", 4, "Qu\u00e1 h\u1ea1n", 3), numberCell("E", 4, BigDecimal.valueOf(overdueCount), 3),
                textCell("G", 4, "T\u1ed5ng c\u00f2n n\u1ee3", 3), moneyCell("H", 4, remainingAmount, 4)));
        appendRow(xml, 5, List.of(
                textCell("A", 5, "T\u1ed5ng h\u00f3a \u0111\u01a1n", 3), moneyCell("B", 5, totalAmount, 4),
                textCell("D", 5, "\u0110\u00e3 thanh to\u00e1n", 3), moneyCell("E", 5, paidAmount, 4)));
        appendRow(xml, 6, List.of(
                textCell("A", 6, "Nh\u00e0 cung c\u1ea5p", 5),
                textCell("B", 6, "H\u00f3a \u0111\u01a1n", 5),
                textCell("C", 6, "\u0110\u01a1n h\u00e0ng", 5),
                textCell("D", 6, "S\u1ea3n ph\u1ea9m", 5),
                textCell("E", 6, "S\u1ed1 l\u01b0\u1ee3ng", 5),
                textCell("F", 6, "\u0110\u01a1n v\u1ecb", 5),
                textCell("G", 6, "Ng\u00e0y t\u1ea1o", 5),
                textCell("H", 6, "H\u1ea1n thanh to\u00e1n", 5),
                textCell("I", 6, "Tr\u1ea1ng th\u00e1i", 5),
                textCell("J", 6, "T\u1ed5ng ti\u1ec1n", 5),
                textCell("K", 6, "\u0110\u00e3 tr\u1ea3", 5),
                textCell("L", 6, "C\u00f2n n\u1ee3", 5),
                textCell("M", 6, "Qu\u00e1 h\u1ea1n", 5)));

        int rowIndex = 7;
        for (DebtExportRow row : rows) {
            int overdueStyle = row.overdueDays() != null && row.overdueDays() > 0 ? 7 : 6;
            appendRow(xml, rowIndex, List.of(
                    textCell("A", rowIndex, row.supplier(), 6),
                    textCell("B", rowIndex, row.invoice(), 6),
                    textCell("C", rowIndex, row.orderRef(), 6),
                    textCell("D", rowIndex, row.product(), 6),
                    numberCell("E", rowIndex, nullToZero(row.quantity()), 6),
                    textCell("F", rowIndex, row.unit(), 6),
                    textCell("G", rowIndex, formatExcelDate(row.createdDate()), 6),
                    textCell("H", rowIndex, formatExcelDate(row.dueDate()), 6),
                    textCell("I", rowIndex, row.statusLabel(), overdueStyle),
                    moneyCell("J", rowIndex, row.total(), 4),
                    moneyCell("K", rowIndex, row.paid(), 4),
                    moneyCell("L", rowIndex, row.remaining(), 4),
                    numberCell("M", rowIndex, BigDecimal.valueOf(row.overdueDays() == null ? 0 : row.overdueDays()), overdueStyle)));
            rowIndex++;
        }
        if (rows.isEmpty()) {
            appendRow(xml, 7, List.of(textCell("A", 7, "Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u ph\u00f9 h\u1ee3p v\u1edbi b\u1ed9 l\u1ecdc.", 2)));
        }

        xml.append("</sheetData>");
        xml.append("<autoFilter ref=\"A6:M").append(Math.max(lastRow, 7)).append("\"/>");
        xml.append("<mergeCells count=\"3\"><mergeCell ref=\"A1:M1\"/><mergeCell ref=\"A2:M2\"/><mergeCell ref=\"A3:M3\"/></mergeCells>");
        xml.append("<pageMargins left=\"0.7\" right=\"0.7\" top=\"0.75\" bottom=\"0.75\" header=\"0.3\" footer=\"0.3\"/>");
        xml.append("</worksheet>");
        return xml.toString();
    }

    private String exportFilterText(Long supplierId, String status, LocalDate fromDate, LocalDate toDate) {
        List<String> parts = new ArrayList<>();
        parts.add("Nh\u00e0 cung c\u1ea5p: " + (supplierId == null ? "T\u1ea5t c\u1ea3" : "#" + supplierId));
        parts.add("Tr\u1ea1ng th\u00e1i: " + (status == null || status.isBlank() || "all".equalsIgnoreCase(status) ? "T\u1ea5t c\u1ea3" : status));
        parts.add("T\u1eeb ng\u00e0y: " + formatExcelDate(fromDate));
        parts.add("\u0110\u1ebfn ng\u00e0y: " + formatExcelDate(toDate));
        return String.join(" | ", parts);
    }

    private void appendRow(StringBuilder xml, int rowIndex, List<String> cells) {
        xml.append("<row r=\"").append(rowIndex).append("\">");
        cells.forEach(xml::append);
        xml.append("</row>");
    }

    private String textCell(String col, int row, String value, int style) {
        return "<c r=\"" + col + row + "\" s=\"" + style + "\" t=\"inlineStr\"><is><t>" + xml(value) + "</t></is></c>";
    }

    private String numberCell(String col, int row, BigDecimal value, int style) {
        return "<c r=\"" + col + row + "\" s=\"" + style + "\"><v>" + nullToZero(value).stripTrailingZeros().toPlainString() + "</v></c>";
    }

    private String moneyCell(String col, int row, BigDecimal value, int style) {
        return numberCell(col, row, value, style);
    }

    private String formatExcelDate(LocalDate date) {
        return date == null ? "" : date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private void writeZipEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String contentTypesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """.trim();
    }

    private String rootRelsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """.trim();
    }

    private String workbookXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="Cong no" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """.trim();
    }

    private String workbookRelsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """.trim();
    }

    private String stylesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;VND&quot;"/></numFmts>
                  <fonts count="4">
                    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
                    <font><b/><sz val="18"/><color rgb="FF047857"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
                  </fonts>
                  <fills count="5">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFEFFDF5"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF059669"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1F2"/><bgColor indexed="64"/></patternFill></fill>
                  </fills>
                  <borders count="2">
                    <border><left/><right/><top/><bottom/><diagonal/></border>
                    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
                  </borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="8">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
                    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
                    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
                    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
                  </cellXfs>
                </styleSheet>
                """.trim();
    }

    private String xml(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private DebtContext loadContext() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        List<OrderEntity> orders = orderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(buyerCompanyId).stream()
                .filter(order -> !EXCLUDED_ORDER_STATUSES.contains(order.getStatus()))
                .toList();
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();
        List<InvoiceEntity> invoices = orderIds.isEmpty() ? List.of() : invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<Long> invoiceIds = invoices.stream().map(InvoiceEntity::getId).toList();
        List<InvoiceItemEntity> invoiceItems = invoiceIds.isEmpty() ? List.of() : invoiceItemRepository.findByInvoiceIdIn(invoiceIds);
        Map<Long, InvoiceItemEntity> invoiceItemByInvoiceId = invoiceItems.stream()
                .collect(Collectors.toMap(InvoiceItemEntity::getInvoiceId, Function.identity(), (a, b) -> a));
        List<OrderItemEntity> orderItems = orderIds.isEmpty() ? List.of() : orderItemRepository.findByOrderIdIn(orderIds);
        Map<Long, OrderItemEntity> orderItemById = orderItems.stream()
                .collect(Collectors.toMap(OrderItemEntity::getId, Function.identity(), (a, b) -> a));
        Map<Long, OrderItemEntity> orderMainItemByOrderId = orderItems.stream()
                .collect(Collectors.toMap(OrderItemEntity::getOrderId, Function.identity(), (a, b) -> a));
        List<Long> batchIds = orderItems.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).distinct().toList();
        Map<Long, BatchEntity> batchesById = batchIds.isEmpty() ? Map.of() : batchRepository.findAllById(batchIds).stream().collect(Collectors.toMap(BatchEntity::getId, Function.identity()));
        Map<Long, ProductEntity> productsById = loadProductsForLines(orderItems, invoiceItems, batchesById);
        Map<Long, InvoiceLine> invoiceMainItemByInvoiceId = invoices.stream()
                .collect(Collectors.toMap(
                        InvoiceEntity::getId,
                        invoice -> {
                            InvoiceItemEntity invoiceItem = invoiceItemByInvoiceId.get(invoice.getId());
                            OrderItemEntity orderItem = invoiceItem == null || invoiceItem.getOrderItemId() == null ? null : orderItemById.get(invoiceItem.getOrderItemId());
                            if (orderItem == null) orderItem = orderMainItemByOrderId.get(invoice.getOrderId());
                            InvoiceLine orderLine = toInvoiceLine(orderItem, productsById, batchesById);
                            InvoiceLine invoiceLine = toInvoiceLine(invoiceItem, orderLine, productsById);
                            return invoiceLine == null ? new InvoiceLine(null, null, null) : invoiceLine;
                        },
                        (a, b) -> a));
        List<ShipmentEntity> shipments = orderIds.isEmpty() ? List.of() : shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        Map<Long, LocalDateTime> confirmedReceivedAtByOrderId = shipments.stream()
                .filter(item -> item.getConfirmedReceivedAt() != null)
                .collect(Collectors.toMap(ShipmentEntity::getOrderId, ShipmentEntity::getConfirmedReceivedAt, (a, b) -> a.isAfter(b) ? a : b));
        Map<Long, LocalDateTime> expectedDeliveryAtByOrderId = shipments.stream()
                .map(item -> {
                    LocalDateTime expected = item.getEstimatedDeliveryAt() != null ? item.getEstimatedDeliveryAt() : item.getExpectedDeliveryDate();
                    return expected == null ? null : Map.entry(item.getOrderId(), expected);
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a.isAfter(b) ? a : b));
        List<PaymentEntity> payments = invoiceIds.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoiceIds);
        List<Long> paymentIds = payments.stream().map(PaymentEntity::getId).toList();
        List<PaymentAllocationEntity> allocations = paymentIds.isEmpty() ? List.of() : paymentAllocationRepository.findByPaymentIdIn(paymentIds);
        List<DebtReminderEntity> reminders = invoiceIds.isEmpty() ? List.of() : debtReminderRepository.findByInvoiceIdInOrderByCreatedAtDesc(invoiceIds);
        List<DebtAdjustmentEntity> adjustments = invoiceIds.isEmpty() ? List.of() : debtAdjustmentRepository.findByInvoiceIdInOrderByCreatedAtDesc(invoiceIds);
        Map<Long, OrderEntity> ordersById = orders.stream().collect(Collectors.toMap(OrderEntity::getId, Function.identity()));
        Map<Long, PaymentEntity> paymentsById = payments.stream().collect(Collectors.toMap(PaymentEntity::getId, Function.identity(), (a, b) -> a));
        Map<Long, BigDecimal> paidByInvoice = buildPaidByInvoice(payments, allocations, paymentsById);
        List<Long> supplierIds = orders.stream().map(OrderEntity::getSupplierCompanyId).filter(Objects::nonNull).distinct().toList();
        Map<Long, CompanyEntity> suppliersById = supplierIds.isEmpty() ? Map.of() : companyRepository.findAllById(supplierIds).stream().collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
        Map<Long, CreditLimitEntity> creditBySupplier = supplierIds.isEmpty() ? Map.of() : creditLimitRepository.findByBuyerCompanyIdAndSupplierCompanyIdIn(buyerCompanyId, supplierIds).stream().collect(Collectors.toMap(CreditLimitEntity::getSupplierCompanyId, Function.identity()));
        Map<Long, UserEntity> usersById = userMap(payments.stream().map(PaymentEntity::getConfirmedByUserId).filter(Objects::nonNull).toList());
        return new DebtContext(buyerCompanyId, orders, invoices, payments, adjustments, reminders, ordersById, paidByInvoice, suppliersById, creditBySupplier, usersById, invoiceMainItemByInvoiceId, confirmedReceivedAtByOrderId, expectedDeliveryAtByOrderId);
    }

    private List<BuyerDebtDtos.Kpi> buildKpis(DebtContext context) {
        List<InvoiceCalc> invoices = context.invoices().stream()
                .map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId())))
                .toList();
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
                new BuyerDebtDtos.Kpi("totalDebt", "Tổng phải trả", totalDebt, formatMoney(totalDebt)),
                new BuyerDebtDtos.Kpi("overdueDebt", "Quá hạn", overdueDebt, formatMoney(overdueDebt)),
                new BuyerDebtDtos.Kpi("paidThisMonth", "Đã thanh toán tháng", paidThisMonth, formatMoney(paidThisMonth)),
                new BuyerDebtDtos.Kpi("dueSoon", "Sắp đến hạn", dueSoon, formatMoney(dueSoon)),
                new BuyerDebtDtos.Kpi("unpaidInvoiceCount", "Hóa đơn chưa tất toán", BigDecimal.valueOf(unpaidCount), String.valueOf(unpaidCount)),
                new BuyerDebtDtos.Kpi("overdueInvoiceCount", "Hóa đơn quá hạn", BigDecimal.valueOf(overdueCount), String.valueOf(overdueCount)));
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
        List<InvoiceCalc> calcs = invoices.stream()
                .map(invoice -> calc(invoice, context.paidByInvoice().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId())))
                .toList();
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
        BigDecimal creditRemaining = calcs.stream()
                .filter(item -> "CREDIT_TERM".equals(item.paymentPlanType()))
                .map(InvoiceCalc::remaining)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal creditOverdue = calcs.stream()
                .filter(item -> "CREDIT_TERM".equals(item.paymentPlanType()))
                .filter(InvoiceCalc::overdue)
                .map(InvoiceCalc::remaining)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal creditDueSoon = calcs.stream()
                .filter(item -> "CREDIT_TERM".equals(item.paymentPlanType()))
                .filter(InvoiceCalc::dueSoon)
                .map(InvoiceCalc::remaining)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal usage = limit.compareTo(BigDecimal.ZERO) > 0 ? creditRemaining.multiply(BigDecimal.valueOf(100)).divide(limit, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        String status = status(Boolean.TRUE.equals(credit == null ? null : credit.getIsBlocked()), creditOverdue, usage, creditDueSoon);
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
                credit == null || credit.getStatus() == null ? null : credit.getStatus().name(),
                status,
                statusLabel(status));
    }

    private BuyerDebtDtos.InvoiceItem toInvoiceItem(InvoiceEntity invoice, DebtContext context) {
        return toInvoiceItem(invoice, context.paidByInvoice().get(invoice.getId()), context.invoiceMainItemByInvoiceId().get(invoice.getId()), context.confirmedReceivedAtByOrderId().get(invoice.getOrderId()));
    }

    private BuyerDebtDtos.InvoiceItem toInvoiceItem(InvoiceEntity invoice, BigDecimal paidValue) {
        InvoiceLine mainItem = resolveInvoiceLine(invoice);
        LocalDateTime confirmedReceivedAt = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(invoice.getOrderId()).map(ShipmentEntity::getConfirmedReceivedAt).orElse(null);
        return toInvoiceItem(invoice, paidValue, mainItem, confirmedReceivedAt);
    }

    private BuyerDebtDtos.InvoiceItem toInvoiceItem(InvoiceEntity invoice, BigDecimal paidValue, InvoiceLine mainItem, LocalDateTime confirmedReceivedAt) {
        InvoiceCalc calc = calc(invoice, paidValue, confirmedReceivedAt);
        String paymentPlan = paymentPlanType(invoice);
        LocalDateTime expectedDueAt = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(invoice.getOrderId())
                .map(item -> item.getEstimatedDeliveryAt() != null ? item.getEstimatedDeliveryAt() : item.getExpectedDeliveryDate())
                .orElse(null);
        return new BuyerDebtDtos.InvoiceItem(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                invoice.getOrderId(),
                orderCode(invoice.getOrderId()),
                mainItem == null ? null : mainItem.productName(),
                mainItem == null ? null : mainItem.quantity(),
                mainItem == null ? null : mainItem.unit(),
                invoice.getCreatedAt(),
                confirmedReceivedAt,
                invoice.getDueDate(),
                expectedDueAt == null ? null : expectedDueAt.toLocalDate(),
                dueLabel(paymentPlan, invoice.getDueDate(), confirmedReceivedAt, expectedDueAt),
                invoice.getTotalAmount(),
                calc.amount(),
                calc.paid(),
                calc.remaining(),
                paymentPlan,
                paymentTermDays(invoice),
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

    private BuyerDebtDtos.ReminderItem toReminderItem(DebtReminderEntity reminder, Boolean isRead) {
        Long orderId = reminder.getOrderId();
        InvoiceEntity invoice = reminder.getInvoiceId() == null ? null : invoiceRepository.findById(reminder.getInvoiceId()).orElse(null);
        if (orderId == null && invoice != null) orderId = invoice.getOrderId();
        String invoiceNumber = invoice == null ? null : invoice.getInvoiceNumber();
        InvoiceLine mainItem = invoice == null ? null : resolveInvoiceLine(invoice);
        LocalDateTime confirmedReceivedAt = orderId == null ? null : shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId).map(ShipmentEntity::getConfirmedReceivedAt).orElse(null);
        String dueLabel = dueLabel(invoice == null ? "" : paymentPlanType(invoice), invoice == null ? null : invoice.getDueDate(), confirmedReceivedAt, null);
        UserEntity sender = reminder.getCreatedByUserId() == null ? null : userRepository.findById(reminder.getCreatedByUserId()).orElse(null);
        String status = reminder.getStatus() == null ? null : reminder.getStatus().name();
        if (Boolean.TRUE.equals(isRead) && "SENT".equals(status)) status = "READ";
        return new BuyerDebtDtos.ReminderItem(
                reminder.getId(),
                reminder.getInvoiceId(),
                invoiceNumber,
                orderId,
                orderId == null ? null : orderCode(orderId),
                mainItem == null ? null : mainItem.productName(),
                mainItem == null ? null : mainItem.quantity(),
                mainItem == null ? null : mainItem.unit(),
                dueLabel,
                reminder.getAmount(),
                reminder.getMessage(),
                reminder.getChannel(),
                status,
                sender == null ? null : firstText(sender.getFullName(), firstText(sender.getEmail(), sender.getPhone())),
                reminder.getSentAt(),
                reminder.getCreatedAt());
    }

    private InvoiceCalc calc(InvoiceEntity invoice, BigDecimal paidValue, LocalDateTime confirmedReceivedAt) {
        BigDecimal amount = invoiceAmount(invoice);
        BigDecimal paid = nullToZero(paidValue);
        BigDecimal remaining = amount.subtract(paid);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) remaining = BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        String plan = paymentPlanType(invoice);
        LocalDate effectiveDueDate = invoice.getDueDate();
        if ("DEPOSIT_50".equals(plan)) {
            if (confirmedReceivedAt == null) {
                effectiveDueDate = null;
            } else if (effectiveDueDate == null) {
                effectiveDueDate = confirmedReceivedAt.toLocalDate();
            }
        }
        boolean overdue = remaining.compareTo(BigDecimal.ZERO) > 0 && effectiveDueDate != null && effectiveDueDate.isBefore(today);
        boolean dueSoon = remaining.compareTo(BigDecimal.ZERO) > 0 && effectiveDueDate != null && !effectiveDueDate.isBefore(today) && !effectiveDueDate.isAfter(today.plusDays(7));
        long overdueDays = overdue ? ChronoUnit.DAYS.between(effectiveDueDate, today) : 0;
        return new InvoiceCalc(amount, paid, remaining, overdue, dueSoon, overdueDays, plan);
    }

    private BigDecimal invoiceAmount(InvoiceEntity invoice) {
        BigDecimal adjusted = nullToZero(invoice.getAdjustedAmount());
        return adjusted.compareTo(BigDecimal.ZERO) > 0 ? adjusted : nullToZero(invoice.getTotalAmount());
    }

    private BigDecimal paidAmount(Collection<PaymentEntity> payments) {
        return payments.stream().map(this::paymentAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal paymentAmount(PaymentEntity payment) {
        if (payment == null || payment.getStatus() == null || !List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(payment.getStatus().trim().toUpperCase(Locale.ROOT))) {
            return BigDecimal.ZERO;
        }
        BigDecimal paidAmount = nullToZero(payment.getPaidAmount());
        return paidAmount.compareTo(BigDecimal.ZERO) > 0 ? paidAmount : nullToZero(payment.getAmount());
    }

    private InvoiceStatusEnum resolveInvoiceStatus(InvoiceEntity invoice, BigDecimal paid, BigDecimal remaining) {
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) return InvoiceStatusEnum.PAID;
        if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now())) return InvoiceStatusEnum.OVERDUE;
        if (paid.compareTo(BigDecimal.ZERO) > 0) return InvoiceStatusEnum.PARTIAL;
        return InvoiceStatusEnum.UNPAID;
    }

    private void createSupplierPaymentNotification(InvoiceEntity invoice, OrderEntity order, BigDecimal amount, LocalDateTime paymentTime) {
        CompanyEntity buyer = companyRepository.findById(order.getBuyerCompanyId()).orElse(null);
        String buyerName = buyer == null ? "Buyer" : buyer.getName();
        notificationCenterService.notifySupplierRemainingPaid(order, invoice, amount, buyerName);
    }

    private String status(boolean blocked, BigDecimal overdue, BigDecimal usage, BigDecimal dueSoon) {
        if (blocked) return "BLOCKED";
        if (overdue.compareTo(BigDecimal.ZERO) > 0) return "OVERDUE";
        if (usage.compareTo(BigDecimal.valueOf(80)) >= 0 || dueSoon.compareTo(BigDecimal.ZERO) > 0) return "WARNING";
        return "NORMAL";
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "BLOCKED" -> "Bị chặn";
            case "OVERDUE" -> "Quá hạn";
            case "WARNING" -> "Cảnh báo";
            default -> "Bình thường";
        };
    }

    private String invoiceStatusLabel(InvoiceEntity invoice, InvoiceCalc calc) {
        if (calc.remaining().compareTo(BigDecimal.ZERO) <= 0) return "Đã thanh toán";
        if (calc.overdue()) return "Quá hạn";
        if (calc.paid().compareTo(BigDecimal.ZERO) > 0) return "Thanh toán một phần";
        if (calc.dueSoon()) return "Sắp đến hạn";
        return invoice.getStatus() == null ? "Chưa thanh toán" : invoice.getStatus().name();
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

    private InvoiceLine resolveInvoiceLine(InvoiceEntity invoice) {
        if (invoice == null) return null;
        InvoiceItemEntity invoiceItem = invoiceItemRepository.findByInvoiceIdIn(List.of(invoice.getId())).stream().findFirst().orElse(null);
        OrderItemEntity orderItem = invoiceItem == null || invoiceItem.getOrderItemId() == null
                ? null
                : orderItemRepository.findById(invoiceItem.getOrderItemId()).orElse(null);
        if (orderItem == null) orderItem = orderItemRepository.findByOrderIdOrderByIdAsc(invoice.getOrderId()).stream().findFirst().orElse(null);
        Map<Long, BatchEntity> batchesById = orderItem == null || orderItem.getBatchId() == null
                ? Map.of()
                : batchRepository.findAllById(List.of(orderItem.getBatchId())).stream().collect(Collectors.toMap(BatchEntity::getId, Function.identity()));
        Map<Long, ProductEntity> productsById = loadProductsForLines(
                orderItem == null ? List.of() : List.of(orderItem),
                invoiceItem == null ? List.of() : List.of(invoiceItem),
                batchesById);
        InvoiceLine orderLine = toInvoiceLine(orderItem, productsById, batchesById);
        return toInvoiceLine(invoiceItem, orderLine, productsById);
    }

    private Map<Long, ProductEntity> loadProductsForLines(List<OrderItemEntity> orderItems, List<InvoiceItemEntity> invoiceItems, Map<Long, BatchEntity> batchesById) {
        List<Long> productIds = new ArrayList<>();
        orderItems.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull).forEach(productIds::add);
        invoiceItems.stream().map(InvoiceItemEntity::getProductId).filter(Objects::nonNull).forEach(productIds::add);
        orderItems.stream()
                .map(OrderItemEntity::getBatchId)
                .filter(Objects::nonNull)
                .map(batchesById::get)
                .filter(Objects::nonNull)
                .map(BatchEntity::getProductId)
                .filter(Objects::nonNull)
                .forEach(productIds::add);
        List<Long> distinctIds = productIds.stream().distinct().toList();
        return distinctIds.isEmpty()
                ? Map.of()
                : productRepository.findByIdIn(distinctIds).stream().collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
    }

    private InvoiceLine toInvoiceLine(InvoiceItemEntity item, InvoiceLine orderLine, Map<Long, ProductEntity> productsById) {
        if (item == null) return orderLine;
        ProductEntity product = item.getProductId() == null ? null : productsById.get(item.getProductId());
        return new InvoiceLine(
                firstText(firstText(item.getDescription(), null), orderLine == null ? product == null ? null : product.getName() : orderLine.productName()),
                item.getQuantity(),
                firstText(item.getUnit(), orderLine == null ? product == null ? null : product.getUnit() : orderLine.unit()));
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
                firstText(item.getUnit(), product == null ? null : product.getUnit()));
    }

    private String paymentPlanType(InvoiceEntity invoice) {
        String method = firstText(invoice.getPaymentMethod(), "");
        if ("DEPOSIT_50".equalsIgnoreCase(method)) return "DEPOSIT_50";
        if ("CREDIT".equalsIgnoreCase(method) || "DEBT".equalsIgnoreCase(method)) return "CREDIT_TERM";
        return "PREPAID";
    }

    private String dueLabel(String paymentPlan, LocalDate dueDate, LocalDateTime confirmedReceivedAt, LocalDateTime expectedDueAt) {
        if ("DEPOSIT_50".equalsIgnoreCase(paymentPlan)) {
            if (confirmedReceivedAt == null) {
                if (expectedDueAt != null) {
                    return "Khi nhận hàng (dự kiến: " + expectedDueAt.toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")) + ")";
                }
                return "Khi nhận hàng";
            }
            return confirmedReceivedAt.toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        }
        if ("PREPAID".equalsIgnoreCase(paymentPlan)) return "Ngay khi đặt hàng";
        if (dueDate == null) return "Chưa xác định";
        return dueDate.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }
private Integer paymentTermDays(InvoiceEntity invoice) {
        if (invoice.getDueDate() == null || invoice.getCreatedAt() == null) return null;
        return (int) ChronoUnit.DAYS.between(invoice.getCreatedAt().toLocalDate(), invoice.getDueDate());
    }

    private Map<Long, BigDecimal> buildPaidByInvoice(List<PaymentEntity> payments, List<PaymentAllocationEntity> allocations, Map<Long, PaymentEntity> paymentsById) {
        Map<Long, BigDecimal> paidByInvoice = new java.util.HashMap<>();
        Map<Long, BigDecimal> allocatedByPaymentId = allocations.stream()
                .collect(Collectors.groupingBy(PaymentAllocationEntity::getPaymentId, Collectors.mapping(PaymentAllocationEntity::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        allocations.stream()
                .filter(allocation -> {
                    PaymentEntity payment = paymentsById.get(allocation.getPaymentId());
                    return payment != null && payment.getStatus() != null && List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(payment.getStatus().trim().toUpperCase(Locale.ROOT));
                })
                .forEach(allocation -> paidByInvoice.merge(allocation.getInvoiceId(), nullToZero(allocation.getAmount()), BigDecimal::add));

        payments.stream()
                .filter(payment -> payment.getStatus() != null && List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(payment.getStatus().trim().toUpperCase(Locale.ROOT)))
                .filter(payment -> payment.getInvoiceId() != null)
                .filter(payment -> nullToZero(allocatedByPaymentId.get(payment.getId())).compareTo(BigDecimal.ZERO) <= 0)
                .forEach(payment -> paidByInvoice.merge(payment.getInvoiceId(), paymentAmount(payment), BigDecimal::add));
        return paidByInvoice;
    }

    private record DebtExportRow(
            String supplier,
            String invoice,
            String orderRef,
            String product,
            BigDecimal quantity,
            String unit,
            LocalDate createdDate,
            LocalDate dueDate,
            String statusLabel,
            BigDecimal total,
            BigDecimal paid,
            BigDecimal remaining,
            Long overdueDays
    ) {
    }

    private record DebtContext(
            Long buyerCompanyId,
            List<OrderEntity> orders,
            List<InvoiceEntity> invoices,
            List<PaymentEntity> payments,
            List<DebtAdjustmentEntity> adjustments,
            List<DebtReminderEntity> reminders,
            Map<Long, OrderEntity> ordersById,
            Map<Long, BigDecimal> paidByInvoice,
            Map<Long, CompanyEntity> suppliersById,
            Map<Long, CreditLimitEntity> creditBySupplier,
            Map<Long, UserEntity> usersById,
            Map<Long, InvoiceLine> invoiceMainItemByInvoiceId,
            Map<Long, LocalDateTime> confirmedReceivedAtByOrderId,
            Map<Long, LocalDateTime> expectedDeliveryAtByOrderId
    ) {
    }

    private record InvoiceCalc(BigDecimal amount, BigDecimal paid, BigDecimal remaining, boolean overdue, boolean dueSoon, long overdueDays, String paymentPlanType) {
    }

    private record InvoiceLine(String productName, BigDecimal quantity, String unit) {
    }
}
