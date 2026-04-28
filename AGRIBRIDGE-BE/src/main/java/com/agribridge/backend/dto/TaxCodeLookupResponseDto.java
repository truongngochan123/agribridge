package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TaxCodeLookupResponseDto {

    private boolean found;
    private String taxCode;
    private String companyName;
    private String province;
    private String ward;
    private String address;
    private String message;
}
