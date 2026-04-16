package com.agribridge.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminOverviewActivityRequestDto {

    private String title;
    private String description;
    private String time;
    private String color;
}
