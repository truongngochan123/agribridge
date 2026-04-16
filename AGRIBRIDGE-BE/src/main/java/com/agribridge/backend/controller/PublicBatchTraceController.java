package com.agribridge.backend.controller;

import com.agribridge.backend.dto.PublicBatchTraceResponseDto;
import com.agribridge.backend.service.PublicBatchTraceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/batch")
@RequiredArgsConstructor
public class PublicBatchTraceController {

    private final PublicBatchTraceService publicBatchTraceService;

    @GetMapping("/{id}")
    public PublicBatchTraceResponseDto getPublicBatch(@PathVariable("id") Long batchId) {
        return publicBatchTraceService.getPublicBatchTrace(batchId);
    }
}
