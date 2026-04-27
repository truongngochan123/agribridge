package com.agribridge.backend.controller;

import com.agribridge.backend.service.BuyerOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/orders")
@RequiredArgsConstructor
public class BuyerOrderController {

    private final BuyerOrderService buyerOrderService;

    @PatchMapping("/{orderId}/confirm-received")
    public void confirmReceived(@PathVariable Long orderId, @RequestParam Long companyId) {
        buyerOrderService.confirmReceived(companyId, orderId);
    }
}
