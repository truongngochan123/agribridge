package com.agribridge.backend.dto;

import java.time.LocalDateTime;

public record RfqMessageDto(
        Long id,
        Long rfqId,
        Long senderUserId,
        Long senderCompanyId,
        String senderRole,
        String message,
        LocalDateTime createdAt) {
}
