package com.agribridge.backend.controller;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.dto.SendRfqMessageDto;
import com.agribridge.backend.service.RfqMessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class RfqMessageWebSocketController {

    private final RfqMessageService rfqMessageService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(@Valid SendRfqMessageDto request) {
        RfqMessageDto savedMessage = rfqMessageService.saveMessage(request);
        messagingTemplate.convertAndSend("/topic/rfq." + savedMessage.rfqId(), savedMessage);
    }
}
