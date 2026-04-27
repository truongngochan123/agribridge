package com.agribridge.backend.service;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.dto.SendRfqMessageDto;
import java.util.List;

public interface RfqMessageService {

    List<RfqMessageDto> getMessagesByRfq(Long rfqId);

    RfqMessageDto saveMessage(SendRfqMessageDto request);
}
