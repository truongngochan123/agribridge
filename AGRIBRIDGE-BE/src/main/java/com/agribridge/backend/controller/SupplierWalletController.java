package com.agribridge.backend.controller;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.service.WalletService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier/wallet")
@RequiredArgsConstructor
public class SupplierWalletController {
    private final WalletService walletService;

    @GetMapping
    public WalletDtos.WalletSummary getWallet() {
        return walletService.getSupplierWallet();
    }

    @GetMapping("/ledger")
    public List<WalletDtos.LedgerItem> getLedger() {
        return walletService.getSupplierLedger();
    }

    @PostMapping("/withdrawals")
    public WalletDtos.WithdrawalItem createWithdrawal(@RequestBody WalletDtos.WithdrawalRequest request) {
        return walletService.createSupplierWithdrawal(request);
    }
}
