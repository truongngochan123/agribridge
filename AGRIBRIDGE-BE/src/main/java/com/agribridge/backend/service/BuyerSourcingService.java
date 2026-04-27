package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerSourcingProductDto;
import com.agribridge.backend.dto.CreateBuyerRfqDto;
import java.util.List;

public interface BuyerSourcingService {

    List<BuyerSourcingProductDto> getProducts();

    BuyerSourcingProductDto getProduct(Long productId);

    Long createRfq(CreateBuyerRfqDto request);
}
