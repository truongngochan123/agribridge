package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerOrderDto;
import com.agribridge.backend.dto.BuyerQuickOrderRequestDto;
import com.agribridge.backend.dto.BuyerQuickOrderResponseDto;
import com.agribridge.backend.dto.CreateBuyerComplaintRequestDto;
import java.util.List;

public interface BuyerOrderService {

    List<BuyerOrderDto> getCurrentBuyerOrders();

    BuyerOrderDto getCurrentBuyerOrder(Long orderId);

    BuyerQuickOrderResponseDto createQuickOrder(BuyerQuickOrderRequestDto request);

    BuyerOrderDto.ComplaintDto createComplaint(Long orderId, CreateBuyerComplaintRequestDto request);

    void confirmReceived(Long buyerCompanyId, Long orderId);

    void confirmReceived(Long orderId);
}
