package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.UploadedFileResponseDto;
import com.agribridge.backend.service.FileUploadService;
import com.cloudinary.Cloudinary;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Primary
@RequiredArgsConstructor
@Slf4j
public class CloudinaryFileUploadServiceImpl implements FileUploadService {

    private final Cloudinary cloudinary;

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

        return upload(file, resolveResourceType(file), "registration-files");
    }

    @Override
    public UploadedFileResponseDto uploadSupplierDocument(MultipartFile file) {
        log.info("Uploading supplier document originalName={} size={}",
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getSize());

        return upload(file, resolveResourceType(file), "supplier-documents");
    }

    @Override
    public UploadedFileResponseDto uploadBatchVideo(MultipartFile file) {
        log.info("Uploading batch video originalName={} size={}",
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getSize());

        return upload(file, "video", "batch-videos");
    }

    private UploadedFileResponseDto upload(MultipartFile file, String resourceType, String subFolder) {
        if (file == null || file.isEmpty()) {
            log.warn("Upload rejected because file is empty resourceType={}", resourceType);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UPLOAD_FILE_REQUIRED");
        }

        if (isCloudinaryConfigMissing()) {
            log.warn("Cloudinary upload rejected because CLOUDINARY_* config is missing resourceType={}", resourceType);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "CLOUDINARY_CONFIG_MISSING: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET");
        }

        try {
            String targetFolder = folder + "/" + subFolder;

            Map<String, Object> options = new HashMap<>();
            options.put("folder", targetFolder);
            options.put("resource_type", resourceType);
            options.put("use_filename", true);
            options.put("unique_filename", true);
            options.put("overwrite", false);

            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), options);

            String secureUrl = stringValue(result.get("secure_url"));

            UploadedFileResponseDto response = UploadedFileResponseDto.builder()
                    .url(secureUrl)
                    .secureUrl(secureUrl)
                    .publicId(stringValue(result.get("public_id")))
                    .format(stringValue(result.get("format")))
                    .resourceType(stringValue(result.get("resource_type")))
                    .originalFilename(file.getOriginalFilename())
                    .build();

            log.info("Uploaded file successfully originalName={} resourceType={} folder={} publicId={} url={}",
                    file.getOriginalFilename(),
                    resourceType,
                    targetFolder,
                    response.getPublicId(),
                    secureUrl);

            return response;

        } catch (IOException ex) {
            log.error("Cannot read upload file originalName={} resourceType={}",
                    file.getOriginalFilename(), resourceType, ex);

            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UPLOAD_FILE_READ_FAILED", ex);

        } catch (Exception ex) {
            log.error("Cloud upload failed originalName={} resourceType={}",
                    file.getOriginalFilename(), resourceType, ex);

            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "CLOUDINARY_UPLOAD_FAILED", ex);
        }
    }

    private String resolveResourceType(MultipartFile file) {
        String contentType = file == null ? null : file.getContentType();

        if (contentType == null || contentType.isBlank()) {
            return "auto";
        }

        if (contentType.startsWith("image/")) {
            return "image";
        }

        if (contentType.startsWith("video/")) {
            return "video";
        }

        return "auto";
    }

    private boolean isCloudinaryConfigMissing() {
        return isMissingConfigValue(cloudName)
                || isMissingConfigValue(apiKey)
                || isMissingConfigValue(apiSecret);
    }

    private boolean isMissingConfigValue(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }

        return value.trim().startsWith("your-");
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}