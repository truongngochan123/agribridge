package com.agribridge.backend.service;

public interface BuyerOrderService {

    void confirmReceived(Long buyerCompanyId, Long orderId);
}
