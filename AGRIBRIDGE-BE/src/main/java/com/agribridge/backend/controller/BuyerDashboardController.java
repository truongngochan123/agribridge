package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerDashboardDtos;
import com.agribridge.backend.service.BuyerDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/dashboard")
@RequiredArgsConstructor
public class BuyerDashboardController {

    private final BuyerDashboardService buyerDashboardService;

    @GetMapping
    public BuyerDashboardDtos.Response getDashboard() {
        return buyerDashboardService.getDashboard();
    }
}
