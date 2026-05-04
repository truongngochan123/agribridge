package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerMarketPriceDtos;
import java.util.List;

public interface BuyerMarketPriceService {

    List<BuyerMarketPriceDtos.Row> getMarketPrices(String keyword, Long categoryId, String productType, String region, String grade, String size, String sourceType, String range);

    BuyerMarketPriceDtos.Filters getFilters();

    BuyerMarketPriceDtos.HistoryResponse getHistory(String productTypeKey, String region, String grade, String size, String unit, String sourceType, String range);

    List<BuyerMarketPriceDtos.SupplierListing> getSuppliers(String productTypeKey, String region, String grade, String size, String unit);
}
