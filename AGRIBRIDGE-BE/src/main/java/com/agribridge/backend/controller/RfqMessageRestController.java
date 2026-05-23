package com.agribridge.backend.controller;

import com.agribridge.backend.dto.PostRfqMessageDto;
import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.service.RfqMessageService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rfqs")
@RequiredArgsConstructor
public class RfqMessageRestController {

    private final RfqMessageService rfqMessageService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/{rfqId}/messages")
    public List<RfqMessageDto> getMessages(
            @PathVariable Long rfqId,
            @RequestParam(required = false) Long supplierCompanyId) {
        return rfqMessageService.getMessagesForCurrentUser(rfqId, supplierCompanyId);
    }

    @PostMapping("/{rfqId}/messages")
    public RfqMessageDto sendMessage(
            @PathVariable Long rfqId,
            @Valid @RequestBody PostRfqMessageDto request) {
        RfqMessageDto savedMessage = rfqMessageService.saveMessageForCurrentUser(rfqId, request.supplierCompanyId(), request.message());
        messagingTemplate.convertAndSend("/topic/rfq." + savedMessage.rfqId() + ".supplier." + savedMessage.supplierCompanyId(), savedMessage);
        return savedMessage;
    }
}
