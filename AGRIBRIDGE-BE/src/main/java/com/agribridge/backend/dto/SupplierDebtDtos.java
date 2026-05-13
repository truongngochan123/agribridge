package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class SupplierDebtDtos {
    private SupplierDebtDtos() {
    }

    public record Overview(List<Kpi> kpis, List<BuyerDebt> buyers) {
    }

    public record Kpi(String id, String label, BigDecimal value, String displayValue) {
    }

    public record BuyerDebt(
            Long buyerId,
            String buyerName,
            Integer invoiceCount,
            Integer unpaidInvoiceCount,
            Integer overdueInvoiceCount,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            BigDecimal overdueAmount,
            BigDecimal dueSoonAmount,
            BigDecimal creditLimit,
            BigDecimal usedCredit,
            BigDecimal remainingCredit,
            Integer paymentTermDays,
            String creditStatus,
            String status,
            String statusLabel
    ) {
    }

    public record BuyerDetail(
            BuyerDebt summary,
            List<InvoiceItem> invoices,
            List<PaymentItem> payments,
            List<AdjustmentItem> adjustments,
            List<ReminderItem> reminders,
            CreditLimitItem creditLimit
    ) {
    }

    public record InvoiceItem(
            Long invoiceId,
            String invoiceCode,
            String displayInvoiceCode,
            String invoiceNumber,
            Long orderId,
            String orderCode,
            String orderRef,
            String productName,
            BigDecimal quantity,
            String unit,
            String batchCode,
            LocalDateTime createdAt,
            LocalDateTime confirmedReceivedAt,
            LocalDate dueDate,
            LocalDate expectedDueDate,
            String dueLabel,
            BigDecimal totalAmount,
            BigDecimal adjustmentAmount,
            BigDecimal outstandingAmount,
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

    public record PaymentItem(Long paymentId, Long invoiceId, BigDecimal amount, LocalDateTime paymentDate, String paymentMethod, String note, String confirmedBy) {
    }

    public record AdjustmentItem(Long adjustmentId, Long invoiceId, BigDecimal amount, String adjustmentType, String description, LocalDateTime createdAt) {
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

    public record CreditLimitItem(Long id, Long buyerId, BigDecimal creditLimit, Integer paymentTermDays, String status, String note) {
    }

    public record CreditLimitRequest(Long buyerId, BigDecimal creditLimit, Integer paymentTermDays, String status, String note) {
    }

    public record PaymentAllocationRequest(Long invoiceId, BigDecimal amount) {
    }

    public record PaymentRequest(Long buyerId, BigDecimal amount, String paymentMethod, LocalDateTime paymentDate, String note, List<PaymentAllocationRequest> allocations) {
    }

    public record AdjustmentRequest(Long invoiceId, BigDecimal amount, String adjustmentType, String description) {
    }

    public record ReminderRequest(
            Long buyerId,
            Long invoiceId,
            BigDecimal amount,
            String message,
            String channel,
            Boolean sendSystemNotification,
            Boolean markOnBuyerDebtPage
    ) {
    }
}
