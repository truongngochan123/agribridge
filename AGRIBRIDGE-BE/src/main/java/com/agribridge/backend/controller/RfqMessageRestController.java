package com.agribridge.backend.controller;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.service.RfqMessageService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rfqs")
@RequiredArgsConstructor
public class RfqMessageRestController {

    private final RfqMessageService rfqMessageService;

    @GetMapping("/{rfqId}/messages")
    public List<RfqMessageDto> getMessages(@PathVariable Long rfqId) {
        return rfqMessageService.getMessagesByRfq(rfqId);
    }
}
