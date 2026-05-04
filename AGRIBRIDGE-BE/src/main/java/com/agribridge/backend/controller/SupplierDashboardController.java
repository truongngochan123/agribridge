package com.agribridge.backend.controller;

import com.agribridge.backend.dto.SupplierDashboardResponseDto;
import com.agribridge.backend.service.SupplierDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier/dashboard")
@RequiredArgsConstructor
public class SupplierDashboardController {

    private final SupplierDashboardService supplierDashboardService;

    @GetMapping
    public SupplierDashboardResponseDto getDashboard() {
        return supplierDashboardService.getDashboard();
    }
}
