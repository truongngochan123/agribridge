package com.agribridge.backend.dto;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthResponseDto {

    private String status;
    private String message;
    private String redirectPath;
    private Long userId;
    private Long companyId;
    private String companyType;
    private String userStatus;
    private String verificationStatus;
    private String verificationNote;
    private String trustLevel;
    private BigDecimal creditLimit;
    private boolean canUseCredit;
}
