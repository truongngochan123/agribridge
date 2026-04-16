package com.agribridge.backend.service.impl;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@Slf4j
public class LocalUploadStorageService {

    private static final DateTimeFormatter NAME_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss", Locale.ROOT);

    @Value("${app.upload.local-dir:local-upload-storage}")
    private String localUploadDir;

    public StoredLocalUpload store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }

        try {
            Path storageDir = resolveStorageDir();
            Files.createDirectories(storageDir);

            String originalFilename = file.getOriginalFilename();
            String storedFileName = buildStoredFileName(originalFilename);
            Path target = storageDir.resolve(storedFileName).normalize();

            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            }

            log.info("Stored upload locally fileName={} target={}", storedFileName, target);
            return new StoredLocalUpload(
                    storedFileName,
                    "/api/uploads/local/" + storedFileName,
                    originalFilename,
                    probeContentType(target));
        } catch (IOException exception) {
            log.error("Failed to store upload locally originalName={}", file.getOriginalFilename(), exception);
            throw new IllegalStateException("Cannot store upload file locally", exception);
        }
    }

    public Resource loadAsResource(String fileName) {
        try {
            Path filePath = resolveStorageDir().resolve(fileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Uploaded file not found: " + fileName);
            }
            return resource;
        } catch (MalformedURLException exception) {
            throw new IllegalArgumentException("Uploaded file is invalid: " + fileName, exception);
        }
    }

    public String probeContentType(String fileName) {
        return probeContentType(resolveStorageDir().resolve(fileName).normalize());
    }

    private String probeContentType(Path filePath) {
        try {
            String contentType = Files.probeContentType(filePath);
            return contentType == null ? "application/octet-stream" : contentType;
        } catch (IOException exception) {
            return "application/octet-stream";
        }
    }

    private Path resolveStorageDir() {
        return Paths.get(localUploadDir).toAbsolutePath().normalize();
    }

    private String buildStoredFileName(String originalFilename) {
        String safeName = originalFilename == null ? "upload" : originalFilename.replaceAll("[^A-Za-z0-9._-]", "_");
        int dotIndex = safeName.lastIndexOf('.');
        String baseName = dotIndex > 0 ? safeName.substring(0, dotIndex) : safeName;
        String extension = dotIndex > 0 ? safeName.substring(dotIndex) : "";
        return baseName + "_" + LocalDateTime.now().format(NAME_TIME_FORMATTER) + "_" + UUID.randomUUID() + extension;
    }

    public record StoredLocalUpload(String storedFileName, String publicUrl, String originalFilename, String contentType) {
    }
}
