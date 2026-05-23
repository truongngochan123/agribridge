package com.agribridge.backend.service;

import com.agribridge.backend.dto.WalletDtos;
import java.util.Map;

public interface MomoPaymentService {
    WalletDtos.MomoPaymentResponse createBuyerPayment(Long paymentId);

    WalletDtos.MomoPaymentResponse createBuyerRemainingPayment(Long orderId);

    Map<String, Object> handleIpn(Map<String, Object> payload);
}
