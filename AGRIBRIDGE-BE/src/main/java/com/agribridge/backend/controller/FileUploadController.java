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

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final LocalUploadStorageService localUploadStorageService;

    @PostMapping("/registration-file")
    public UploadedFileResponseDto uploadRegistrationFile(@RequestParam("file") MultipartFile file) {
        return fileUploadService.uploadRegistrationFile(file);
    }

    @PostMapping("/supplier-document")
    public UploadedFileResponseDto uploadSupplierDocument(@RequestParam("file") MultipartFile file) {
        return fileUploadService.uploadSupplierDocument(file);
    }

    @PostMapping("/batch-video")
    public UploadedFileResponseDto uploadBatchVideo(@RequestParam("file") MultipartFile file) {
        return fileUploadService.uploadBatchVideo(file);
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
}
