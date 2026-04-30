package com.agribridge.backend.service;

public interface MarketPriceAggregationService {

    void rebuildInternalMarketPrices();

    void updateFromSupplierListings();

    void updateFromOrder(Long orderId);

    String normalizeProductTypeName(String name);
}
