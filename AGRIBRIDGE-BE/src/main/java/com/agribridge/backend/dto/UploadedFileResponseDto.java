package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UploadedFileResponseDto {

    private String url;
    private String publicId;
    private String format;
    private String resourceType;
    private String originalFilename;
}