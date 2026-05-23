package com.agribridge.backend.controller;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.service.MomoPaymentService;
import com.agribridge.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class BuyerPaymentController {
    private final MomoPaymentService momoPaymentService;
    private final WalletService walletService;

    @PostMapping("/api/buyer/payments/{paymentId}/momo")
    public WalletDtos.MomoPaymentResponse createMomoPayment(@PathVariable Long paymentId) {
        return momoPaymentService.createBuyerPayment(paymentId);
    }

    @PostMapping("/api/buyer/orders/{orderId}/remaining-payment/momo")
    public WalletDtos.MomoPaymentResponse createRemainingMomoPayment(@PathVariable Long orderId) {
        return momoPaymentService.createBuyerRemainingPayment(orderId);
    }

    @GetMapping("/api/buyer/wallet/summary")
    public WalletDtos.WalletSummary getBuyerWalletSummary() {
        return walletService.getBuyerWalletSummary();
    }
}
