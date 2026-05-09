package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerOrderDto;
import com.agribridge.backend.dto.BuyerQuickOrderRequestDto;
import com.agribridge.backend.dto.BuyerQuickOrderResponseDto;
import com.agribridge.backend.service.BuyerOrderService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderDemoController {

    private final BuyerOrderService buyerOrderService;

    @PostMapping("/checkout")
    public BuyerQuickOrderResponseDto checkout(@Valid @RequestBody BuyerQuickOrderRequestDto request) {
        return buyerOrderService.createQuickOrder(request);
    }

    @PostMapping("/{orderId}/demo-confirm-payment")
    public BuyerOrderDto demoConfirmPayment(@PathVariable Long orderId) {
        return buyerOrderService.demoConfirmPayment(orderId);
    }

    @PostMapping("/{orderId}/demo-pay-remaining")
    public BuyerOrderDto demoPayRemaining(@PathVariable Long orderId) {
        return buyerOrderService.demoPayRemaining(orderId);
    }

    @PostMapping("/{orderId}/confirm-received")
    public void confirmReceived(@PathVariable Long orderId) {
        buyerOrderService.confirmReceived(orderId);
    }

    @GetMapping("/my")
    public List<BuyerOrderDto> myOrders() {
        return buyerOrderService.getCurrentBuyerOrders();
    }

    @GetMapping("/{orderId}")
    public BuyerOrderDto getOrder(@PathVariable Long orderId) {
        return buyerOrderService.getCurrentBuyerOrder(orderId);
    }
}
