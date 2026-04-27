package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.UploadedFileResponseDto;
import com.agribridge.backend.service.FileUploadService;
import com.cloudinary.Cloudinary;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class CloudinaryFileUploadServiceImpl implements FileUploadService {

    private final Cloudinary cloudinary;
    private final LocalUploadStorageService localUploadStorageService;

    @Value("${cloudinary.folder:agribridge}")
    private String folder;

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    @Override
    public UploadedFileResponseDto uploadRegistrationFile(MultipartFile file) {
        log.info("Uploading registration file originalName={} size={}",
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getSize());
        return upload(file);
    }

    @Override
    public UploadedFileResponseDto uploadSupplierDocument(MultipartFile file) {
        log.info("Uploading supplier document originalName={} size={}",
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getSize());
        return upload(file);
    }

    @Override
    public UploadedFileResponseDto uploadBatchVideo(MultipartFile file) {
        log.info("Uploading batch video originalName={} size={}",
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getSize());
        return upload(file, "video");
    }

    private UploadedFileResponseDto upload(MultipartFile file) {
        return upload(file, "auto");
    }

    private UploadedFileResponseDto upload(MultipartFile file, String resourceType) {
        if (file == null || file.isEmpty()) {
            log.warn("Upload rejected because file is empty resourceType={}", resourceType);
            throw new IllegalArgumentException("File is required");
        }
        if (cloudName == null || cloudName.isBlank()
                || apiKey == null || apiKey.isBlank()
                || apiSecret == null || apiSecret.isBlank()) {
            log.warn("Cloudinary is not configured. Falling back to local upload resourceType={}", resourceType);
            return uploadLocally(file, resourceType);
        }

        try {
            Map<String, Object> options = new HashMap<>();
            options.put("folder", folder);
            options.put("resource_type", resourceType);
            options.put("use_filename", true);
            options.put("unique_filename", true);
            options.put("overwrite", false);

            Map<?, ?> result;
            try (InputStream inputStream = file.getInputStream()) {
                result = cloudinary.uploader().upload(inputStream, options);
            }

            UploadedFileResponseDto response = UploadedFileResponseDto.builder()
                    .url(String.valueOf(result.get("secure_url")))
                    .publicId(String.valueOf(result.get("public_id")))
                    .format(result.get("format") == null ? null : String.valueOf(result.get("format")))
                    .resourceType(
                            result.get("resource_type") == null ? null : String.valueOf(result.get("resource_type")))
                    .originalFilename(file.getOriginalFilename())
                    .build();
            log.info("Uploaded file successfully originalName={} resourceType={} publicId={}",
                    file.getOriginalFilename(), resourceType, response.getPublicId());
            return response;
        } catch (IOException ex) {
            log.error("Cannot read upload file directly, falling back to local upload originalName={} resourceType={}",
                    file.getOriginalFilename(), resourceType, ex);
            return uploadLocally(file, resourceType);
        } catch (Exception ex) {
            log.error("Cloud upload failed originalName={} resourceType={}", file.getOriginalFilename(), resourceType,
                    ex);
            return uploadLocally(file, resourceType);
        }
    }

    private UploadedFileResponseDto uploadLocally(MultipartFile file, String resourceType) {
        LocalUploadStorageService.StoredLocalUpload storedUpload = localUploadStorageService.store(file);
        UploadedFileResponseDto response = UploadedFileResponseDto.builder()
                .url(storedUpload.publicUrl())
                .publicId(storedUpload.storedFileName())
                .format(storedUpload.contentType())
                .resourceType(resourceType)
                .originalFilename(storedUpload.originalFilename())
                .build();
        log.info("Uploaded file locally as fallback originalName={} storedName={} resourceType={}",
                file.getOriginalFilename(), storedUpload.storedFileName(), resourceType);
        return response;
    }
}
