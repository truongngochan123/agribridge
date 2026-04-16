package com.agribridge.backend.service;

import com.agribridge.backend.dto.UploadedFileResponseDto;
import org.springframework.web.multipart.MultipartFile;

public interface FileUploadService {

    UploadedFileResponseDto uploadRegistrationFile(MultipartFile file);

    UploadedFileResponseDto uploadSupplierDocument(MultipartFile file);

    UploadedFileResponseDto uploadBatchVideo(MultipartFile file);
}