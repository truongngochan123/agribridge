package com.agribridge.backend.service;

import com.agribridge.backend.dto.AdminDisputeDto;
import java.util.List;

public interface AdminDisputeService {

    List<AdminDisputeDto> getDisputes(String search, String status);

    AdminDisputeDto getDisputeById(Long disputeId);

    AdminDisputeDto createDispute(
            Long orderId,
            Long batchId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution);

    AdminDisputeDto updateDispute(
            Long disputeId,
            Long orderId,
            Long batchId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution);

    AdminDisputeDto updateDisputeStatus(Long disputeId, Long assignedToUserId, String status, String resolution);

    void deleteDispute(Long disputeId);
}
