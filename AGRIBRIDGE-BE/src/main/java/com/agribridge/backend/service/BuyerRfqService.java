package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerRfqCompareResponse;
import com.agribridge.backend.dto.BuyerRfqDetailResponse;
import com.agribridge.backend.dto.BuyerRfqListItemResponse;
import com.agribridge.backend.dto.ConvertQuoteToOrderRequest;
import com.agribridge.backend.dto.ConvertQuoteToOrderResponse;
import com.agribridge.backend.dto.CreateBuyerRfqRequest;
import com.agribridge.backend.dto.UpdateBuyerRfqRequest;
import org.springframework.data.domain.Page;

import java.util.List;

public interface BuyerRfqService {

    Page<BuyerRfqListItemResponse> getRfqs(String status, String keyword, int page, int size);

    BuyerRfqDetailResponse getRfq(Long rfqId);

    BuyerRfqCompareResponse compareQuotes(Long rfqId);

    BuyerRfqDetailResponse createRfq(CreateBuyerRfqRequest request);

    BuyerRfqDetailResponse updateRfq(Long rfqId, UpdateBuyerRfqRequest request);

    void cancelRfq(Long rfqId);

    ConvertQuoteToOrderResponse convertQuoteToOrder(
            Long rfqId,
            Long quoteId,
            ConvertQuoteToOrderRequest request);

    List<ConvertQuoteToOrderResponse> getRfqOrders(Long rfqId);
}
