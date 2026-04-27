package com.agribridge.backend.service;

import com.agribridge.backend.dto.CreateSupplierQuoteDto;
import com.agribridge.backend.dto.RejectSupplierRfqDto;
import com.agribridge.backend.dto.SupplierQuoteContextDto;

public interface SupplierRfqQuoteService {

    SupplierQuoteContextDto getQuoteContext(Long rfqId);

    void createOrUpdateQuote(Long rfqId, CreateSupplierQuoteDto request);

    void rejectRfq(Long rfqId, RejectSupplierRfqDto request);
}
