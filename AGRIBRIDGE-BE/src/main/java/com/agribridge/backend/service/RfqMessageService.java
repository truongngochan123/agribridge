package com.agribridge.backend.service;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.dto.SendRfqMessageDto;
import java.util.List;

public interface RfqMessageService {

    List<RfqMessageDto> getMessagesByRfq(Long rfqId);

    List<RfqMessageDto> getMessagesForCurrentUser(Long rfqId, Long supplierCompanyId);

    RfqMessageDto saveMessage(SendRfqMessageDto request);

    RfqMessageDto saveMessageForCurrentUser(Long rfqId, Long supplierCompanyId, String message);
}
