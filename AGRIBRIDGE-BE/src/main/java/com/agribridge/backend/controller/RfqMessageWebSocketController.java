package com.agribridge.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class RfqMessageWebSocketController {

    @MessageMapping("/chat.send")
    public void sendMessage() {
        throw new IllegalStateException("RFQ chat messages must be sent through REST API");
    }
}
