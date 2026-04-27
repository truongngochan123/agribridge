package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.dto.SendRfqMessageDto;
import com.agribridge.backend.entity.RfqMessageEntity;
import com.agribridge.backend.repository.RfqMessageRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.RfqMessageService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RfqMessageServiceImpl implements RfqMessageService {

    private static final int MAX_MESSAGE_LENGTH = 2_000;

    private final RfqMessageRepository rfqMessageRepository;
    private final RfqRepository rfqRepository;

    @Override
    @Transactional(readOnly = true)
    public List<RfqMessageDto> getMessagesByRfq(Long rfqId) {
        validateRfqExists(rfqId);
        return rfqMessageRepository.findByRfqIdOrderByCreatedAtAsc(rfqId).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public RfqMessageDto saveMessage(SendRfqMessageDto request) {
        validateRfqExists(request.rfqId());

        String message = normalizeMessage(request.message());
        String senderRole = normalizeSenderRole(request.senderRole());

        RfqMessageEntity saved = rfqMessageRepository.save(RfqMessageEntity.builder()
                .rfqId(Objects.requireNonNull(request.rfqId()))
                .senderUserId(Objects.requireNonNull(request.senderUserId()))
                .senderCompanyId(Objects.requireNonNull(request.senderCompanyId()))
                .senderRole(senderRole)
                .message(message)
                .createdAt(LocalDateTime.now())
                .build());

        return toDto(saved);
    }

    private void validateRfqExists(Long rfqId) {
        if (rfqId == null || !rfqRepository.existsById(rfqId)) {
            throw new IllegalArgumentException("RFQ does not exist");
        }
    }

    private String normalizeMessage(String rawMessage) {
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message must be at most " + MAX_MESSAGE_LENGTH + " characters");
        }
        return message;
    }

    private String normalizeSenderRole(String rawSenderRole) {
        String senderRole = rawSenderRole == null ? "" : rawSenderRole.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("BUYER", "SUPPLIER", "ADMIN").contains(senderRole)) {
            throw new IllegalArgumentException("Sender role is invalid");
        }
        return senderRole;
    }

    private RfqMessageDto toDto(RfqMessageEntity entity) {
        return new RfqMessageDto(
                entity.getId(),
                entity.getRfqId(),
                entity.getSenderUserId(),
                entity.getSenderCompanyId(),
                entity.getSenderRole(),
                entity.getMessage(),
                entity.getCreatedAt());
    }
}
