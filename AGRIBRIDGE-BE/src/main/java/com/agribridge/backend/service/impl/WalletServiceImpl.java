package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.WalletAccountEntity;
import com.agribridge.backend.entity.WalletLedgerEntryEntity;
import com.agribridge.backend.entity.WithdrawalRequestEntity;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.WalletAccountRepository;
import com.agribridge.backend.repository.WalletLedgerEntryRepository;
import com.agribridge.backend.repository.WithdrawalRequestRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.NotificationCenterService;
import com.agribridge.backend.service.WalletService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {
    private static final List<String> PAID_STATUSES = List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS");
    private static final BigDecimal WITHDRAWAL_FEE_RATE = new BigDecimal("0.01");

    private final WalletAccountRepository walletAccountRepository;
    private final WalletLedgerEntryRepository walletLedgerEntryRepository;
    private final WithdrawalRequestRepository withdrawalRequestRepository;
    private final PaymentRepository paymentRepository;
    private final CompanyRepository companyRepository;
    private final CurrentUserService currentUserService;
    private final NotificationCenterService notificationCenterService;

    @Override
    @Transactional
    public void releaseEscrowToSupplier(OrderEntity order, BigDecimal amount, LocalDateTime now) {
        if (order == null || order.getId() == null || order.getSupplierCompanyId() == null) {
            throw new IllegalArgumentException("Order is required");
        }
        BigDecimal releaseAmount = positive(amount);
        if (releaseAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Release amount must be greater than zero");
        }
        if (walletLedgerEntryRepository.existsByOrderIdAndEntryType(order.getId(), "ESCROW_RELEASED")) {
            return;
        }
        WalletAccountEntity wallet = requireWallet(order.getSupplierCompanyId(), now);
        wallet.setAvailableBalance(positive(wallet.getAvailableBalance()).add(releaseAmount));
        wallet.setTotalEarned(positive(wallet.getTotalEarned()).add(releaseAmount));
        wallet.setUpdatedAt(now);
        walletAccountRepository.save(wallet);
        addLedger(wallet, order.getId(), null, null, "ESCROW_RELEASED", releaseAmount, "Platform released escrow to supplier", now);
    }

    @Override
    @Transactional(readOnly = true)
    public WalletDtos.WalletSummary getSupplierWallet() {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        WalletAccountEntity wallet = walletAccountRepository.findByCompanyId(supplierCompanyId).orElse(null);
        List<WithdrawalRequestEntity> withdrawals = withdrawalRequestRepository.findBySupplierCompanyIdOrderByRequestedAtDesc(supplierCompanyId);
        return new WalletDtos.WalletSummary(
                supplierCompanyId,
                wallet == null ? BigDecimal.ZERO : positive(wallet.getAvailableBalance()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getPendingBalance()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getTotalEarned()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getTotalWithdrawn()),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                List.of(),
                withdrawals.stream().map(this::toWithdrawal).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public WalletDtos.WalletSummary getBuyerWalletSummary() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        WalletAccountEntity wallet = walletAccountRepository.findByCompanyId(buyerCompanyId).orElse(null);
        List<WithdrawalRequestEntity> withdrawals = withdrawalRequestRepository.findBySupplierCompanyIdOrderByRequestedAtDesc(buyerCompanyId);
        List<PaymentEntity> payments = paymentRepository.findByBuyerCompanyIdOrderByPaymentDateDesc(buyerCompanyId);
        BigDecimal held = payments.stream()
                .filter(payment -> "HELD".equalsIgnoreCase(nullToEmpty(payment.getEscrowStatus())) || "PARTIALLY_HELD".equalsIgnoreCase(nullToEmpty(payment.getEscrowStatus())))
                .map(this::paidAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstanding = payments.stream()
                .filter(payment -> !isPaid(payment))
                .map(PaymentEntity::getAmount)
                .map(this::positive)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new WalletDtos.WalletSummary(
                buyerCompanyId,
                wallet == null ? BigDecimal.ZERO : positive(wallet.getAvailableBalance()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getPendingBalance()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getTotalEarned()),
                wallet == null ? BigDecimal.ZERO : positive(wallet.getTotalWithdrawn()),
                held,
                outstanding,
                payments.stream().map(this::toPayment).toList(),
                withdrawals.stream().map(this::toWithdrawal).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletDtos.LedgerItem> getSupplierLedger() {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        return walletLedgerEntryRepository.findByCompanyIdOrderByCreatedAtDesc(supplierCompanyId).stream()
                .map(this::toLedger)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletDtos.LedgerItem> getBuyerLedger() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        return walletLedgerEntryRepository.findByCompanyIdOrderByCreatedAtDesc(buyerCompanyId).stream()
                .map(this::toLedger)
                .toList();
    }

    @Override
    @Transactional
    public WalletDtos.WithdrawalItem createSupplierWithdrawal(WalletDtos.WithdrawalRequest request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        LocalDateTime now = LocalDateTime.now();
        BigDecimal amount = request == null ? BigDecimal.ZERO : positive(request.amount());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("WITHDRAW_AMOUNT_INVALID");
        BigDecimal feeAmount = calculateWithdrawalFee(amount);
        BigDecimal payoutAmount = amount.subtract(feeAmount);
        if (payoutAmount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("WITHDRAW_AMOUNT_INVALID");
        WalletAccountEntity wallet = requireWallet(supplierCompanyId, now);
        if (positive(wallet.getAvailableBalance()).compareTo(amount) < 0) throw new IllegalArgumentException("INSUFFICIENT_WALLET_BALANCE");
        wallet.setAvailableBalance(positive(wallet.getAvailableBalance()).subtract(amount));
        wallet.setPendingBalance(positive(wallet.getPendingBalance()).add(payoutAmount));
        wallet.setUpdatedAt(now);
        walletAccountRepository.save(wallet);
        WithdrawalRequestEntity withdrawal = withdrawalRequestRepository.save(WithdrawalRequestEntity.builder()
                .supplierCompanyId(supplierCompanyId)
                .amount(amount)
                .feeAmount(feeAmount)
                .payoutAmount(payoutAmount)
                .bankName(clean(request.bankName()))
                .bankAccountNumber(clean(request.bankAccountNumber()))
                .bankAccountName(clean(request.bankAccountName()))
                .note(clean(request.note()))
                .status("PENDING")
                .requestedAt(now)
                .build());
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_REQUESTED", payoutAmount.negate(), "Số tiền thực chuyển đang chờ rút", now);
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_FEE", feeAmount.negate(), "Phí rút tiền 1% được ghi nhận cho nền tảng", now);
        String supplierName = companyRepository.findById(supplierCompanyId)
                .map(CompanyEntity::getName)
                .filter(name -> !name.isBlank())
                .orElse("Nha cung cap");
        notificationCenterService.notifyAdmins(
                "Yeu cau rut tien moi",
                supplierName + " vua tao yeu cau rut tien " + payoutAmount.toPlainString() + " VND.",
                "WITHDRAWAL",
                "/admin/withdrawals?withdrawalId=" + withdrawal.getId(),
                "WITHDRAWAL",
                withdrawal.getId(),
                true,
                Map.of(
                        "withdrawalId", withdrawal.getId(),
                        "supplierCompanyId", supplierCompanyId,
                        "supplierName", supplierName,
                        "amount", amount,
                        "payoutAmount", payoutAmount,
                        "status", withdrawal.getStatus()));
        return toWithdrawal(withdrawal);
    }

    @Override
    @Transactional
    public WalletDtos.WithdrawalItem createBuyerWithdrawal(WalletDtos.WithdrawalRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        LocalDateTime now = LocalDateTime.now();
        BigDecimal amount = request == null ? BigDecimal.ZERO : positive(request.amount());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("WITHDRAW_AMOUNT_INVALID");
        BigDecimal feeAmount = calculateWithdrawalFee(amount);
        BigDecimal payoutAmount = amount.subtract(feeAmount);
        if (payoutAmount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("WITHDRAW_AMOUNT_INVALID");
        WalletAccountEntity wallet = requireWallet(buyerCompanyId, now);
        if (positive(wallet.getAvailableBalance()).compareTo(amount) < 0) throw new IllegalArgumentException("INSUFFICIENT_WALLET_BALANCE");
        wallet.setAvailableBalance(positive(wallet.getAvailableBalance()).subtract(amount));
        wallet.setPendingBalance(positive(wallet.getPendingBalance()).add(payoutAmount));
        wallet.setUpdatedAt(now);
        walletAccountRepository.save(wallet);
        WithdrawalRequestEntity withdrawal = withdrawalRequestRepository.save(WithdrawalRequestEntity.builder()
                .supplierCompanyId(buyerCompanyId)
                .amount(amount)
                .feeAmount(feeAmount)
                .payoutAmount(payoutAmount)
                .bankName(clean(request.bankName()))
                .bankAccountNumber(clean(request.bankAccountNumber()))
                .bankAccountName(clean(request.bankAccountName()))
                .note(clean(request.note()))
                .status("PENDING")
                .requestedAt(now)
                .build());
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_REQUESTED", payoutAmount.negate(), "Số tiền thực chuyển đang chờ rút", now);
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_FEE", feeAmount.negate(), "Phí rút tiền 1% được ghi nhận cho nền tảng", now);
        return toWithdrawal(withdrawal);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletDtos.WithdrawalItem> getAdminWithdrawals() {
        List<WithdrawalRequestEntity> withdrawals = withdrawalRequestRepository.findAllByOrderByRequestedAtDesc();
        Map<Long, CompanyEntity> companies = companyMap(withdrawals.stream().map(WithdrawalRequestEntity::getSupplierCompanyId).toList());
        return withdrawals.stream().map(item -> toWithdrawal(item, companies.get(item.getSupplierCompanyId()))).toList();
    }

    @Override
    @Transactional
    public WalletDtos.WithdrawalItem approveWithdrawal(Long id, WalletDtos.AdminWithdrawalAction action) {
        WithdrawalRequestEntity withdrawal = requireWithdrawal(id);
        if (!"PENDING".equals(withdrawal.getStatus())) throw new IllegalArgumentException("WITHDRAWAL_NOT_PENDING");
        withdrawal.setStatus("APPROVED");
        review(withdrawal, action);
        return toWithdrawal(withdrawalRequestRepository.save(withdrawal));
    }

    @Override
    @Transactional
    public WalletDtos.WithdrawalItem rejectWithdrawal(Long id, WalletDtos.AdminWithdrawalAction action) {
        WithdrawalRequestEntity withdrawal = requireWithdrawal(id);
        if (!List.of("PENDING", "APPROVED").contains(withdrawal.getStatus())) throw new IllegalArgumentException("WITHDRAWAL_NOT_REJECTABLE");
        LocalDateTime now = LocalDateTime.now();
        WalletAccountEntity wallet = requireWallet(withdrawal.getSupplierCompanyId(), now);
        BigDecimal amount = positive(withdrawal.getAmount());
        BigDecimal payoutAmount = payoutAmount(withdrawal);
        wallet.setAvailableBalance(positive(wallet.getAvailableBalance()).add(amount));
        wallet.setPendingBalance(positive(wallet.getPendingBalance()).subtract(payoutAmount).max(BigDecimal.ZERO));
        wallet.setUpdatedAt(now);
        walletAccountRepository.save(wallet);
        withdrawal.setStatus("REJECTED");
        review(withdrawal, action);
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_REJECTED", amount, "Yêu cầu rút tiền bị từ chối, hoàn lại cả phí", now);
        return toWithdrawal(withdrawalRequestRepository.save(withdrawal));
    }

    @Override
    @Transactional
    public WalletDtos.WithdrawalItem markWithdrawalPaid(Long id, WalletDtos.AdminWithdrawalAction action) {
        WithdrawalRequestEntity withdrawal = requireWithdrawal(id);
        if (!"APPROVED".equals(withdrawal.getStatus())) throw new IllegalArgumentException("WITHDRAWAL_NOT_APPROVED");
        LocalDateTime now = LocalDateTime.now();
        WalletAccountEntity wallet = requireWallet(withdrawal.getSupplierCompanyId(), now);
        BigDecimal payoutAmount = payoutAmount(withdrawal);
        wallet.setPendingBalance(positive(wallet.getPendingBalance()).subtract(payoutAmount).max(BigDecimal.ZERO));
        wallet.setTotalWithdrawn(positive(wallet.getTotalWithdrawn()).add(payoutAmount));
        wallet.setUpdatedAt(now);
        walletAccountRepository.save(wallet);
        withdrawal.setStatus("PAID");
        withdrawal.setPaidAt(now);
        review(withdrawal, action);
        addLedger(wallet, null, null, withdrawal.getId(), "WITHDRAW_PAID", payoutAmount.negate(), "Admin đã chuyển tiền rút cho nhà cung cấp", now);
        return toWithdrawal(withdrawalRequestRepository.save(withdrawal));
    }

    private WalletAccountEntity requireWallet(Long companyId, LocalDateTime now) {
        return walletAccountRepository.findByCompanyId(companyId)
                .orElseGet(() -> walletAccountRepository.save(WalletAccountEntity.builder()
                        .companyId(companyId)
                        .availableBalance(BigDecimal.ZERO)
                        .pendingBalance(BigDecimal.ZERO)
                        .totalEarned(BigDecimal.ZERO)
                        .totalWithdrawn(BigDecimal.ZERO)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()));
    }

    private void addLedger(WalletAccountEntity wallet, Long orderId, Long paymentId, Long withdrawalId, String type, BigDecimal amount, String description, LocalDateTime now) {
        walletLedgerEntryRepository.save(WalletLedgerEntryEntity.builder()
                .walletAccountId(wallet.getId())
                .companyId(wallet.getCompanyId())
                .orderId(orderId)
                .paymentId(paymentId)
                .withdrawalRequestId(withdrawalId)
                .entryType(type)
                .amount(amount)
                .balanceAfter(positive(wallet.getAvailableBalance()))
                .description(description)
                .createdAt(now)
                .build());
    }

    private WithdrawalRequestEntity requireWithdrawal(Long id) {
        return withdrawalRequestRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("WITHDRAWAL_NOT_FOUND"));
    }

    private void review(WithdrawalRequestEntity withdrawal, WalletDtos.AdminWithdrawalAction action) {
        withdrawal.setReviewedAt(LocalDateTime.now());
        withdrawal.setReviewedByUserId(currentUserService.requireCurrentUser().getId());
        if (action != null) withdrawal.setAdminNote(clean(action.note()));
    }

    private WalletDtos.PaymentSummary toPayment(PaymentEntity payment) {
        return new WalletDtos.PaymentSummary(payment.getId(), payment.getOrderId(), payment.getInvoiceId(), positive(payment.getAmount()),
                positive(payment.getPaidAmount()), payment.getPaymentMethod(), payment.getPaymentType(), payment.getStatus(), payment.getEscrowStatus(), payment.getPaidAt());
    }

    private WalletDtos.LedgerItem toLedger(WalletLedgerEntryEntity item) {
        return new WalletDtos.LedgerItem(item.getId(), item.getEntryType(), item.getAmount(), item.getBalanceAfter(), item.getOrderId(),
                item.getPaymentId(), item.getWithdrawalRequestId(), item.getDescription(), item.getCreatedAt());
    }

    private WalletDtos.WithdrawalItem toWithdrawal(WithdrawalRequestEntity item) {
        CompanyEntity company = companyRepository.findById(item.getSupplierCompanyId()).orElse(null);
        return toWithdrawal(item, company);
    }

    private WalletDtos.WithdrawalItem toWithdrawal(WithdrawalRequestEntity item, CompanyEntity company) {
        return new WalletDtos.WithdrawalItem(item.getId(), item.getSupplierCompanyId(), company == null ? null : company.getName(),
                positive(item.getAmount()), feeAmount(item), payoutAmount(item), item.getBankName(), item.getBankAccountNumber(), item.getBankAccountName(), item.getNote(),
                item.getStatus(), item.getRequestedAt(), item.getReviewedAt(), item.getPaidAt(), item.getAdminNote());
    }

    private BigDecimal calculateWithdrawalFee(BigDecimal amount) {
        return positive(amount).multiply(WITHDRAWAL_FEE_RATE).setScale(0, RoundingMode.HALF_UP);
    }

    private BigDecimal feeAmount(WithdrawalRequestEntity withdrawal) {
        BigDecimal fee = withdrawal == null ? BigDecimal.ZERO : withdrawal.getFeeAmount();
        return fee == null ? BigDecimal.ZERO : fee;
    }

    private BigDecimal payoutAmount(WithdrawalRequestEntity withdrawal) {
        if (withdrawal == null) return BigDecimal.ZERO;
        BigDecimal payout = withdrawal.getPayoutAmount();
        return payout == null ? positive(withdrawal.getAmount()).subtract(feeAmount(withdrawal)) : positive(payout);
    }

    private Map<Long, CompanyEntity> companyMap(Collection<Long> ids) {
        return companyRepository.findAllById(ids).stream().collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
    }

    private boolean isPaid(PaymentEntity payment) {
        return payment != null && PAID_STATUSES.contains(nullToEmpty(payment.getStatus()).toUpperCase());
    }

    private BigDecimal paidAmount(PaymentEntity payment) {
        BigDecimal paid = positive(payment.getPaidAmount());
        return paid.compareTo(BigDecimal.ZERO) > 0 ? paid : positive(payment.getAmount());
    }

    private BigDecimal positive(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
