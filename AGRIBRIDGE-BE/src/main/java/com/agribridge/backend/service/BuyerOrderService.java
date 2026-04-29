package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerQuickOrderRequestDto;
import com.agribridge.backend.dto.BuyerQuickOrderResponseDto;

public interface BuyerOrderService {

    BuyerQuickOrderResponseDto createQuickOrder(BuyerQuickOrderRequestDto request);

    void confirmReceived(Long buyerCompanyId, Long orderId);
}
