package com.agribridge.backend.service;

import com.agribridge.backend.dto.TaxCodeLookupResponseDto;

public interface TaxCodeLookupService {

    TaxCodeLookupResponseDto lookupTaxCode(String taxCode);
}
