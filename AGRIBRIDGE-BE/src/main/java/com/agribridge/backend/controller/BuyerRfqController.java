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
import org.springframework.web.bind.annotation.RequestHeader;
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
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return buyerRfqService.getRfqs(resolveCompanyId(headerCompanyId, queryCompanyId), status, keyword, page, size);
    }

    @GetMapping("/{rfqId}")
    public BuyerRfqDetailResponse getRfq(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId) {
        return buyerRfqService.getRfq(resolveCompanyId(headerCompanyId, queryCompanyId), rfqId);
    }

    @GetMapping("/{rfqId}/quotes/compare")
    public BuyerRfqCompareResponse compareQuotes(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId) {
        return buyerRfqService.compareQuotes(resolveCompanyId(headerCompanyId, queryCompanyId), rfqId);
    }

    @PostMapping
    public BuyerRfqDetailResponse createRfq(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @Valid @RequestBody CreateBuyerRfqRequest request) {
        return buyerRfqService.createRfq(resolveCompanyId(headerCompanyId, queryCompanyId), request);
    }

    @PutMapping("/{rfqId}")
    public BuyerRfqDetailResponse updateRfq(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId,
            @RequestBody UpdateBuyerRfqRequest request) {
        return buyerRfqService.updateRfq(resolveCompanyId(headerCompanyId, queryCompanyId), rfqId, request);
    }

    @PatchMapping("/{rfqId}/cancel")
    public void cancelRfq(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId) {
        buyerRfqService.cancelRfq(resolveCompanyId(headerCompanyId, queryCompanyId), rfqId);
    }

    @PostMapping("/{rfqId}/quotes/{quoteId}/convert-to-order")
    public ConvertQuoteToOrderResponse convertQuoteToOrder(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId,
            @PathVariable Long quoteId,
            @RequestBody(required = false) ConvertQuoteToOrderRequest request) {
        return buyerRfqService.convertQuoteToOrder(
                resolveCompanyId(headerCompanyId, queryCompanyId),
                rfqId,
                quoteId,
                request);
    }

    @GetMapping("/{rfqId}/orders")
    public List<ConvertQuoteToOrderResponse> getRfqOrders(
            @RequestHeader(value = "X-Company-Id", required = false) Long headerCompanyId,
            @RequestParam(value = "companyId", required = false) Long queryCompanyId,
            @PathVariable Long rfqId) {
        return buyerRfqService.getRfqOrders(resolveCompanyId(headerCompanyId, queryCompanyId), rfqId);
    }

    private Long resolveCompanyId(Long headerCompanyId, Long queryCompanyId) {
        return headerCompanyId == null ? queryCompanyId : headerCompanyId;
    }
}
