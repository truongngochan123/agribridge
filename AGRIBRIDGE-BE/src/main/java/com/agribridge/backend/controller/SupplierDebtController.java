package com.agribridge.backend.controller;

import com.agribridge.backend.dto.SupplierDebtDtos;
import com.agribridge.backend.service.SupplierDebtService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier/debts")
@RequiredArgsConstructor
public class SupplierDebtController {

    private final SupplierDebtService supplierDebtService;

    @GetMapping
    public SupplierDebtDtos.Overview getDebts() {
        return supplierDebtService.getDebts();
    }

    @GetMapping("/buyers/{buyerId}")
    public SupplierDebtDtos.BuyerDetail getBuyerDetail(@PathVariable Long buyerId) {
        return supplierDebtService.getBuyerDetail(buyerId);
    }

    @PutMapping("/credit-limits")
    public SupplierDebtDtos.CreditLimitItem upsertCreditLimit(@RequestBody SupplierDebtDtos.CreditLimitRequest request) {
        return supplierDebtService.upsertCreditLimit(request);
    }

    @PostMapping("/payments")
    public SupplierDebtDtos.BuyerDetail createPayment(@RequestBody SupplierDebtDtos.PaymentRequest request) {
        return supplierDebtService.createPayment(request);
    }

    @PostMapping("/adjustments")
    public SupplierDebtDtos.BuyerDetail createAdjustment(@RequestBody SupplierDebtDtos.AdjustmentRequest request) {
        return supplierDebtService.createAdjustment(request);
    }

    @PostMapping("/reminders")
    public SupplierDebtDtos.BuyerDetail createReminder(@RequestBody SupplierDebtDtos.ReminderRequest request) {
        return supplierDebtService.createReminder(request);
    }
}
