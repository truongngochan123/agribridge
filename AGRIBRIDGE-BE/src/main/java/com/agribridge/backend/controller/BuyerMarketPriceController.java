package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerMarketPriceDtos;
import com.agribridge.backend.service.BuyerMarketPriceService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/market-prices")
@RequiredArgsConstructor
public class BuyerMarketPriceController {

    private final BuyerMarketPriceService buyerMarketPriceService;

    @GetMapping
    public List<BuyerMarketPriceDtos.Row> getMarketPrices(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String productType,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String sourceType,
            @RequestParam(defaultValue = "30d") String range) {
        return buyerMarketPriceService.getMarketPrices(keyword, categoryId, productType, region, grade, size, sourceType, range);
    }

    @GetMapping("/filters")
    public BuyerMarketPriceDtos.Filters getFilters() {
        return buyerMarketPriceService.getFilters();
    }

    @GetMapping("/{productTypeKey}/history")
    public BuyerMarketPriceDtos.HistoryResponse getHistory(
            @PathVariable String productTypeKey,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String unit,
            @RequestParam(required = false) String sourceType,
            @RequestParam(defaultValue = "30d") String range) {
        return buyerMarketPriceService.getHistory(productTypeKey, region, grade, size, unit, sourceType, range);
    }

    @GetMapping("/{productTypeKey}/suppliers")
    public List<BuyerMarketPriceDtos.SupplierListing> getSuppliers(
            @PathVariable String productTypeKey,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String unit) {
        return buyerMarketPriceService.getSuppliers(productTypeKey, region, grade, size, unit);
    }
}
