package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TaxCodeLookupRequestDto {

    @NotBlank
    private String taxCode;
}
