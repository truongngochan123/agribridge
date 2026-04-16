package com.agribridge.backend.dto;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminOverviewResponseDto {

    private List<AdminStatDto> kpis;
    private List<AdminGmvPointDto> gmvSeries;
    private List<AdminRiskMetricDto> risks;
    private List<AdminActivityDto> activities;
    private List<AdminQuickStatDto> quickStats;

    @Getter
    @Builder
    public static class AdminStatDto {
        private String title;
        private String value;
        private String change;
        private String changeTone;
        private String color;
    }

    @Getter
    @Builder
    public static class AdminGmvPointDto {
        private String label;
        private double value;
    }

    @Getter
    @Builder
    public static class AdminRiskMetricDto {
        private String key;
        private String label;
        private String value;
        private String hint;
        private boolean critical;
    }

    @Getter
    @Builder
    public static class AdminActivityDto {
        private Long id;
        private String title;
        private String description;
        private String time;
        private String color;
    }

    @Getter
    @Builder
    public static class AdminQuickStatDto {
        private Long id;
        private String label;
        private String subLabel;
        private String value;
        private String color;
    }
}
