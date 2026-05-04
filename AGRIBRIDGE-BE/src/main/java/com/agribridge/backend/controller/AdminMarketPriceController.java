package com.agribridge.backend.controller;

import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.MarketPriceAggregationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/market-prices")
@RequiredArgsConstructor
public class AdminMarketPriceController {

    private final MarketPriceAggregationService marketPriceAggregationService;
    private final CurrentUserService currentUserService;

    @PostMapping("/rebuild-internal")
    public void rebuildInternal() {
        if (!UserRoleEnum.ADMIN.equals(currentUserService.requireCurrentUser().getRole())) {
            throw new IllegalArgumentException("ADMIN_REQUIRED");
        }
        marketPriceAggregationService.rebuildInternalMarketPrices();
    }
}
