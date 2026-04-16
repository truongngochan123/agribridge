package com.agribridge.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminQuickStatRequestDto {

    private String label;
    private String subLabel;
    private String value;
    private String color;
}
