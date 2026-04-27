package com.agribridge.backend.dto;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CompanyProfileAssetsResponseDto {

    private String logoUrl;
    private List<MediaItemDto> farmImages;
    private List<MediaItemDto> certificates;

    @Getter
    @Builder
    public static class MediaItemDto {
        private Long id;
        private String label;
        private String imageType;
        private String url;
        private String uploadedAt;
    }
}
