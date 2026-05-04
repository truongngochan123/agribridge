package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TaxCodeLookupResponseDto {

    private boolean found;
    private String provider;
    private String taxCode;
    private String companyName;
    private String address;
    private String province;
    private String ward;
    private String status;
    private String message;
}
