package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerBatchPreviewDto;
import com.agribridge.backend.dto.BuyerSourcingProductDto;
import com.agribridge.backend.dto.CreateBuyerRfqDto;
import java.util.List;

public interface BuyerSourcingService {

    List<BuyerSourcingProductDto> getProducts();

    BuyerSourcingProductDto getProduct(Long productId);

    List<BuyerBatchPreviewDto> getProductBatches(Long productId);

    Long createRfq(CreateBuyerRfqDto request);
}
