package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class BuyerDebtDtos {
    private BuyerDebtDtos() {
    }

    public record Overview(List<Kpi> kpis, List<SupplierDebt> suppliers) {
    }

    public record Kpi(String id, String label, BigDecimal value, String displayValue) {
    }

    public record SupplierDebt(
            Long supplierId,
            String supplierName,
            Integer invoiceCount,
            Integer unpaidInvoiceCount,
            Integer overdueInvoiceCount,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            BigDecimal overdueAmount,
            BigDecimal dueSoonAmount,
            Integer dueSoonInvoiceCount,
            BigDecimal creditLimit,
            Integer paymentTermDays,
            BigDecimal limitUsage,
            Boolean isBlocked,
            String blockedReason,
            String creditStatus,
            String status,
            String statusLabel
    ) {
    }

    public record SupplierDetail(
            SupplierDebt summary,
            List<InvoiceItem> invoices,
            List<PaymentItem> payments,
            List<AdjustmentItem> adjustments,
            List<ReminderItem> reminders
    ) {
    }

    public record InvoiceItem(
            Long invoiceId,
            String invoiceNumber,
            Long orderId,
            String orderRef,
            String productName,
            BigDecimal quantity,
            String unit,
            LocalDateTime createdAt,
            LocalDateTime confirmedReceivedAt,
            LocalDate dueDate,
            LocalDate expectedDueDate,
            String dueLabel,
            BigDecimal totalAmount,
            BigDecimal adjustedAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            String paymentPlanType,
            Integer paymentTermDays,
            String status,
            String statusLabel,
            Long overdueDays
    ) {
    }

    public record PaymentItem(
            Long paymentId,
            Long invoiceId,
            BigDecimal amount,
            LocalDateTime paymentDate,
            String paymentMethod,
            String note,
            String confirmedBy
    ) {
    }

    public record AdjustmentItem(
            Long adjustmentId,
            Long invoiceId,
            BigDecimal amount,
            String adjustmentType,
            String description,
            LocalDateTime createdAt
    ) {
    }

    public record ReminderItem(
            Long reminderId,
            Long invoiceId,
            String invoiceNumber,
            Long orderId,
            String orderCode,
            String productName,
            BigDecimal quantity,
            String unit,
            String dueLabel,
            BigDecimal amount,
            String message,
            String channel,
            String status,
            String senderName,
            LocalDateTime sentAt,
            LocalDateTime createdAt
    ) {
    }

    public record PaymentRequest(
            Long invoiceId,
            BigDecimal amount,
            String paymentMethod,
            LocalDateTime paymentDate,
            String note
    ) {
    }

    public record PaymentResponse(InvoiceItem invoice, PaymentItem payment) {
    }
}
