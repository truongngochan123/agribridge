package com.agribridge.backend.controller;

import com.agribridge.backend.dto.TaxCodeLookupResponseDto;
import com.agribridge.backend.service.TaxCodeLookupService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tax-code")
@RequiredArgsConstructor
public class TaxCodeController {

    private final TaxCodeLookupService taxCodeLookupService;

    @GetMapping("/lookup")
    public TaxCodeLookupResponseDto lookupTaxCode(@RequestParam @NotBlank String taxCode) {
        return taxCodeLookupService.lookupTaxCode(taxCode);
    }
}
