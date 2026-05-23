package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class WalletDtos {
    private WalletDtos() {
    }

    public record WalletSummary(
            Long companyId,
            BigDecimal availableBalance,
            BigDecimal pendingBalance,
            BigDecimal totalEarned,
            BigDecimal totalWithdrawn,
            BigDecimal buyerEscrowHeld,
            BigDecimal buyerOutstanding,
            List<PaymentSummary> payments,
            List<WithdrawalItem> withdrawals) {
    }

    public record PaymentSummary(
            Long paymentId,
            Long orderId,
            Long invoiceId,
            BigDecimal amount,
            BigDecimal paidAmount,
            String paymentMethod,
            String paymentType,
            String status,
            String escrowStatus,
            LocalDateTime paidAt) {
    }

    public record LedgerItem(
            Long id,
            String entryType,
            BigDecimal amount,
            BigDecimal balanceAfter,
            Long orderId,
            Long paymentId,
            Long withdrawalRequestId,
            String description,
            LocalDateTime createdAt) {
    }

    public record WithdrawalItem(
            Long id,
            Long supplierCompanyId,
            String supplierName,
            BigDecimal amount,
            BigDecimal feeAmount,
            BigDecimal payoutAmount,
            String bankName,
            String bankAccountNumber,
            String bankAccountName,
            String note,
            String status,
            LocalDateTime requestedAt,
            LocalDateTime reviewedAt,
            LocalDateTime paidAt,
            String adminNote) {
    }

    public record WithdrawalRequest(
            BigDecimal amount,
            String bankName,
            String bankAccountNumber,
            String bankAccountName,
            String note) {
    }

    public record AdminWithdrawalAction(String note) {
    }

    public record MomoPaymentResponse(
            Long paymentId,
            Long orderId,
            String momoOrderId,
            String requestId,
            BigDecimal amount,
            String payUrl,
            String deeplink,
            String qrCodeUrl,
            String status) {
    }
}
