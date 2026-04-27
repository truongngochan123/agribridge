package com.agribridge.backend.controller;

import com.agribridge.backend.dto.UploadedFileResponseDto;
import com.agribridge.backend.service.FileUploadService;
import com.agribridge.backend.service.impl.LocalUploadStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final LocalUploadStorageService localUploadStorageService;

    @PostMapping("/registration-file")
    public UploadedFileResponseDto uploadRegistrationFile(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "document", required = false) MultipartFile document,
            @RequestParam(value = "video", required = false) MultipartFile video,
            MultipartHttpServletRequest request) {
        return fileUploadService.uploadRegistrationFile(resolveUploadedFile(request, file, document, video));
    }

    @PostMapping("/supplier-document")
    public UploadedFileResponseDto uploadSupplierDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "document", required = false) MultipartFile document,
            MultipartHttpServletRequest request) {
        return fileUploadService.uploadSupplierDocument(resolveUploadedFile(request, file, document));
    }

    @PostMapping("/batch-video")
    public UploadedFileResponseDto uploadBatchVideo(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "video", required = false) MultipartFile video,
            @RequestParam(value = "document", required = false) MultipartFile document,
            MultipartHttpServletRequest request) {
        return fileUploadService.uploadBatchVideo(resolveUploadedFile(request, file, video, document));
    }

    @GetMapping("/local/{fileName:.+}")
    public ResponseEntity<Resource> viewLocalUpload(@PathVariable("fileName") String fileName) {
        Resource resource = localUploadStorageService.loadAsResource(fileName);
        String contentType = localUploadStorageService.probeContentType(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    private MultipartFile resolveUploadedFile(MultipartHttpServletRequest request, MultipartFile... candidates) {
        for (MultipartFile candidate : candidates) {
            if (candidate != null && !candidate.isEmpty()) {
                return candidate;
            }
        }

        if (request != null) {
            for (MultipartFile candidate : request.getFileMap().values()) {
                if (candidate != null && !candidate.isEmpty()) {
                    return candidate;
                }
            }
        }

        throw new IllegalArgumentException("File upload is required");
    }
}
