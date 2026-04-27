package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateUserPersonalProfileDto {

    @NotBlank
    private String fullName;

    @NotBlank
    private String phone;

    private String email;
}
