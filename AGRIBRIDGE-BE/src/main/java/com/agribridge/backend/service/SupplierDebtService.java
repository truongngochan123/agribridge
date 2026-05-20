package com.agribridge.backend.service;

import com.agribridge.backend.dto.SupplierDebtDtos;

public interface SupplierDebtService {

    SupplierDebtDtos.Overview getDebts();

    SupplierDebtDtos.BuyerDetail getBuyerDetail(Long buyerId);

    SupplierDebtDtos.CreditLimitItem upsertCreditLimit(SupplierDebtDtos.CreditLimitRequest request);

    SupplierDebtDtos.BuyerDetail createPayment(SupplierDebtDtos.PaymentRequest request);

    SupplierDebtDtos.BuyerDetail createAdjustment(SupplierDebtDtos.AdjustmentRequest request);

    SupplierDebtDtos.BuyerDetail createReminder(SupplierDebtDtos.ReminderRequest request);
}
