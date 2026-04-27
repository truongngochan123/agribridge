package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpsertCompanyImageDto {

    @NotBlank
    private String url;

    private String label;
}
