package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CreateSupplierQuoteDto;
import com.agribridge.backend.dto.RejectSupplierRfqDto;
import com.agribridge.backend.dto.SupplierQuoteContextDto;
import com.agribridge.backend.service.SupplierRfqQuoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier/rfqs")
@RequiredArgsConstructor
public class SupplierRfqQuoteController {

    private final SupplierRfqQuoteService supplierRfqQuoteService;

    @GetMapping("/{rfqId}/quote-context")
    public SupplierQuoteContextDto getQuoteContext(@PathVariable Long rfqId) {
        return supplierRfqQuoteService.getQuoteContext(rfqId);
    }

    @PostMapping("/{rfqId}/quote")
    public void createOrUpdateQuote(
            @PathVariable Long rfqId,
            @Valid @RequestBody CreateSupplierQuoteDto request) {
        supplierRfqQuoteService.createOrUpdateQuote(rfqId, request);
    }

    @PostMapping("/{rfqId}/reject")
    public void rejectRfq(
            @PathVariable Long rfqId,
            @Valid @RequestBody RejectSupplierRfqDto request) {
        supplierRfqQuoteService.rejectRfq(rfqId, request);
    }
}
