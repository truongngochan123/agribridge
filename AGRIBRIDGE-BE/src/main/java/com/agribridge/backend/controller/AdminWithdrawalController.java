package com.agribridge.backend.controller;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.service.WalletService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/withdrawals")
@RequiredArgsConstructor
public class AdminWithdrawalController {
    private final WalletService walletService;

    @GetMapping
    public List<WalletDtos.WithdrawalItem> getWithdrawals() {
        return walletService.getAdminWithdrawals();
    }

    @PostMapping("/{id}/approve")
    public WalletDtos.WithdrawalItem approve(@PathVariable Long id, @RequestBody(required = false) WalletDtos.AdminWithdrawalAction action) {
        return walletService.approveWithdrawal(id, action);
    }

    @PostMapping("/{id}/reject")
    public WalletDtos.WithdrawalItem reject(@PathVariable Long id, @RequestBody(required = false) WalletDtos.AdminWithdrawalAction action) {
        return walletService.rejectWithdrawal(id, action);
    }

    @PostMapping("/{id}/mark-paid")
    public WalletDtos.WithdrawalItem markPaid(@PathVariable Long id, @RequestBody(required = false) WalletDtos.AdminWithdrawalAction action) {
        return walletService.markWithdrawalPaid(id, action);
    }
}
