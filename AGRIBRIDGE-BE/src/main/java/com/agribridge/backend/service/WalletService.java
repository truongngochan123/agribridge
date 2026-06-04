package com.agribridge.backend.service;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.entity.OrderEntity;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface WalletService {
    void releaseEscrowToSupplier(OrderEntity order, BigDecimal amount, LocalDateTime now);

    WalletDtos.WalletSummary getSupplierWallet();

    WalletDtos.WalletSummary getBuyerWalletSummary();

    List<WalletDtos.LedgerItem> getSupplierLedger();

    List<WalletDtos.LedgerItem> getBuyerLedger();

    WalletDtos.WithdrawalItem createSupplierWithdrawal(WalletDtos.WithdrawalRequest request);

    WalletDtos.WithdrawalItem createBuyerWithdrawal(WalletDtos.WithdrawalRequest request);

    List<WalletDtos.WithdrawalItem> getAdminWithdrawals();

    WalletDtos.WithdrawalItem approveWithdrawal(Long id, WalletDtos.AdminWithdrawalAction action);

    WalletDtos.WithdrawalItem rejectWithdrawal(Long id, WalletDtos.AdminWithdrawalAction action);

    WalletDtos.WithdrawalItem markWithdrawalPaid(Long id, WalletDtos.AdminWithdrawalAction action);
}
