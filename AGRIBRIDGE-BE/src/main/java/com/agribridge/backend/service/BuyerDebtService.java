package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerDebtDtos;

public interface BuyerDebtService {
    BuyerDebtDtos.Overview getDebts();

    BuyerDebtDtos.SupplierDetail getSupplierDetail(Long supplierId);

    BuyerDebtDtos.PaymentResponse createPayment(BuyerDebtDtos.PaymentRequest request);

    java.util.List<BuyerDebtDtos.PaymentItem> getInvoicePayments(Long invoiceId);

    byte[] exportCsv(Long supplierId, String status, java.time.LocalDate fromDate, java.time.LocalDate toDate);
}
