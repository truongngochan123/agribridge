package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerDebtDtos;
import com.agribridge.backend.service.BuyerDebtService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/debts")
@RequiredArgsConstructor
public class BuyerDebtController {

    private final BuyerDebtService buyerDebtService;

    @GetMapping
    public BuyerDebtDtos.Overview getDebts() {
        return buyerDebtService.getDebts();
    }

    @GetMapping("/suppliers/{supplierId}")
    public BuyerDebtDtos.SupplierDetail getSupplierDetail(@PathVariable Long supplierId) {
        return buyerDebtService.getSupplierDetail(supplierId);
    }

    @PostMapping("/payments")
    public BuyerDebtDtos.PaymentResponse createPayment(@RequestBody BuyerDebtDtos.PaymentRequest request) {
        return buyerDebtService.createPayment(request);
    }

    @GetMapping("/invoices/{invoiceId}/payments")
    public List<BuyerDebtDtos.PaymentItem> getInvoicePayments(@PathVariable Long invoiceId) {
        return buyerDebtService.getInvoicePayments(invoiceId);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportDebts(
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=buyer-debts.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(buyerDebtService.exportCsv(supplierId, status, fromDate, toDate));
    }
}
