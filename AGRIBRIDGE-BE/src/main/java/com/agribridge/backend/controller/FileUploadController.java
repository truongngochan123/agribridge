package com.agribridge.backend.controller;

import com.agribridge.backend.dto.UploadedFileResponseDto;
import com.agribridge.backend.service.FileUploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

@RestController
@Slf4j
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;

    @PostMapping("/registration-file")
    public UploadedFileResponseDto uploadRegistrationFile(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "document", required = false) MultipartFile document,
            @RequestParam(value = "video", required = false) MultipartFile video,
            MultipartHttpServletRequest request) {
        log.info("Upload registration request: contentType={} fileMapSize={} filePresent={} documentPresent={} videoPresent={}",
            request.getContentType(),
            request.getFileMap() == null ? 0 : request.getFileMap().size(),
            file != null && !file.isEmpty(),
            document != null && !document.isEmpty(),
            video != null && !video.isEmpty());

        return fileUploadService.uploadRegistrationFile(resolveUploadedFile(request, file, document, video));
    }

    @PostMapping("/supplier-document")
    public UploadedFileResponseDto uploadSupplierDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "document", required = false) MultipartFile document,
            MultipartHttpServletRequest request) {
        log.info("Upload supplier-document request: contentType={} fileMapSize={} filePresent={} documentPresent={}",
            request.getContentType(),
            request.getFileMap() == null ? 0 : request.getFileMap().size(),
            file != null && !file.isEmpty(),
            document != null && !document.isEmpty());

        return fileUploadService.uploadSupplierDocument(resolveUploadedFile(request, file, document));
    }

    @PostMapping("/batch-video")
    public UploadedFileResponseDto uploadBatchVideo(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "video", required = false) MultipartFile video,
            @RequestParam(value = "document", required = false) MultipartFile document,
            MultipartHttpServletRequest request) {
        log.info("Upload batch-video request: contentType={} fileMapSize={} filePresent={} videoPresent={} documentPresent={}",
            request.getContentType(),
            request.getFileMap() == null ? 0 : request.getFileMap().size(),
            file != null && !file.isEmpty(),
            video != null && !video.isEmpty(),
            document != null && !document.isEmpty());

        return fileUploadService.uploadBatchVideo(resolveUploadedFile(request, file, video, document));
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

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UPLOAD_FILE_REQUIRED");
    }
}
