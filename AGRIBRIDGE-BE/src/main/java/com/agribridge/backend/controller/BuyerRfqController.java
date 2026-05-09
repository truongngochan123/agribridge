package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerRfqCompareResponse;
import com.agribridge.backend.dto.BuyerRfqDetailResponse;
import com.agribridge.backend.dto.BuyerRfqListItemResponse;
import com.agribridge.backend.dto.ConvertQuoteToOrderRequest;
import com.agribridge.backend.dto.ConvertQuoteToOrderResponse;
import com.agribridge.backend.dto.CreateBuyerRfqRequest;
import com.agribridge.backend.dto.UpdateBuyerRfqRequest;
import com.agribridge.backend.service.BuyerRfqService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/rfqs")
@RequiredArgsConstructor
public class BuyerRfqController {

    private final BuyerRfqService buyerRfqService;

    @GetMapping
    public Page<BuyerRfqListItemResponse> getRfqs(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return buyerRfqService.getRfqs(status, keyword, page, size);
    }

    @GetMapping("/{rfqId}")
    public BuyerRfqDetailResponse getRfq(
            @PathVariable Long rfqId) {
        return buyerRfqService.getRfq(rfqId);
    }

    @GetMapping("/{rfqId}/quotes/compare")
    public BuyerRfqCompareResponse compareQuotes(
            @PathVariable Long rfqId) {
        return buyerRfqService.compareQuotes(rfqId);
    }

    @PostMapping
    public BuyerRfqDetailResponse createRfq(
            @Valid @RequestBody CreateBuyerRfqRequest request) {
        return buyerRfqService.createRfq(asType(request, "MARKETPLACE"));
    }

    @PostMapping("/marketplace")
    public BuyerRfqDetailResponse createMarketplaceRfq(
            @Valid @RequestBody CreateBuyerRfqRequest request) {
        return buyerRfqService.createRfq(asType(request, "MARKETPLACE"));
    }

    @PostMapping("/direct")
    public BuyerRfqDetailResponse createDirectRfq(
            @Valid @RequestBody CreateBuyerRfqRequest request) {
        return buyerRfqService.createRfq(asType(request, "DIRECT"));
    }

    @PutMapping("/{rfqId}")
    public BuyerRfqDetailResponse updateRfq(
            @PathVariable Long rfqId,
            @RequestBody UpdateBuyerRfqRequest request) {
        return buyerRfqService.updateRfq(rfqId, request);
    }

    @PatchMapping("/{rfqId}/cancel")
    public void cancelRfq(
            @PathVariable Long rfqId) {
        buyerRfqService.cancelRfq(rfqId);
    }

    @PostMapping("/{rfqId}/quotes/{quoteId}/convert-to-order")
    public ConvertQuoteToOrderResponse convertQuoteToOrder(
            @PathVariable Long rfqId,
            @PathVariable Long quoteId,
            @RequestBody(required = false) ConvertQuoteToOrderRequest request) {
        return buyerRfqService.convertQuoteToOrder(rfqId, quoteId, request);
    }

    @PostMapping("/{rfqId}/quotes/{quoteId}/accept")
    public ConvertQuoteToOrderResponse acceptQuote(
            @PathVariable Long rfqId,
            @PathVariable Long quoteId,
            @RequestBody(required = false) ConvertQuoteToOrderRequest request) {
        return buyerRfqService.convertQuoteToOrder(rfqId, quoteId, request);
    }

    @GetMapping("/{rfqId}/orders")
    public List<ConvertQuoteToOrderResponse> getRfqOrders(
            @PathVariable Long rfqId) {
        return buyerRfqService.getRfqOrders(rfqId);
    }

    private CreateBuyerRfqRequest asType(CreateBuyerRfqRequest request, String type) {
        return new CreateBuyerRfqRequest(
                request.title(),
                type,
                request.supplierId(),
                request.supplierCompanyId(),
                request.productName(),
                request.productId(),
                request.categoryId(),
                request.branchId(),
                request.quantity(),
                request.unit(),
                request.province(),
                request.deliveryDate(),
                request.expiredAt(),
                request.description());
    }
}
