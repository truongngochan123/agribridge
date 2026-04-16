package com.agribridge.backend.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUploadedDocumentDto {

    private Long id;
    private String type;
    private String fileName;
    private String uploadedAt;
    private String fileUrl;
}
