package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerOrderDto;
import com.agribridge.backend.dto.BuyerQuickOrderRequestDto;
import com.agribridge.backend.dto.BuyerQuickOrderResponseDto;
import com.agribridge.backend.dto.CreateBuyerComplaintRequestDto;
import com.agribridge.backend.service.BuyerOrderService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/orders")
@RequiredArgsConstructor
public class BuyerOrderController {

    private final BuyerOrderService buyerOrderService;

    @GetMapping
    public List<BuyerOrderDto> getOrders() {
        return buyerOrderService.getCurrentBuyerOrders();
    }

    @GetMapping("/{orderId}")
    public BuyerOrderDto getOrder(@PathVariable Long orderId) {
        return buyerOrderService.getCurrentBuyerOrder(orderId);
    }

    @PostMapping("/quick-order")
    public BuyerQuickOrderResponseDto createQuickOrder(@Valid @RequestBody BuyerQuickOrderRequestDto request) {
        return buyerOrderService.createQuickOrder(request);
    }

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
    public void postConfirmReceived(@PathVariable Long orderId) {
        buyerOrderService.confirmReceived(orderId);
    }

    @PostMapping("/{orderId}/complaints")
    public BuyerOrderDto.ComplaintDto createComplaint(
            @PathVariable Long orderId,
            @Valid @RequestBody CreateBuyerComplaintRequestDto request) {
        return buyerOrderService.createComplaint(orderId, request);
    }

    @PatchMapping("/{orderId}/confirm-received")
    public void confirmReceived(@PathVariable Long orderId, @RequestParam(required = false) Long companyId) {
        if (companyId == null) {
            buyerOrderService.confirmReceived(orderId);
            return;
        }
        buyerOrderService.confirmReceived(companyId, orderId);
    }
}
