package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUserAccountDto {

    private Long userId;
    private Long companyId;
    private String companyName;
    private String email;
    private String phone;
    private String companyType;
    private String companyTypeLabel;
    private String userStatus;
    private String userStatusLabel;
    private Integer orderCount;
    private String rating;
    private String joinedAt;
    private String ownerName;
    private String address;
    private String province;
    private String taxCode;
}
