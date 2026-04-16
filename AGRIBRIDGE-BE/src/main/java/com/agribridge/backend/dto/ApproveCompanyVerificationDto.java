package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApproveCompanyVerificationDto {

    @NotNull
    private Long verifiedByUserId;
}
