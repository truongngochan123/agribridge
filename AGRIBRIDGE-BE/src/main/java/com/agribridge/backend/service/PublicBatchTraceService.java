package com.agribridge.backend.service;

import com.agribridge.backend.dto.PublicBatchTraceResponseDto;

public interface PublicBatchTraceService {

    PublicBatchTraceResponseDto getPublicBatchTrace(Long batchId);
}
