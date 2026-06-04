package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminDisputeDto;
import com.agribridge.backend.dto.AdminDisputeRefundRequestDto;
import com.agribridge.backend.dto.AdminDisputeResolveRequestDto;
import com.agribridge.backend.dto.AdminDisputeStatusUpdateRequestDto;
import com.agribridge.backend.dto.AdminDisputeUpsertRequestDto;
import com.agribridge.backend.service.AdminAuthorizationService;
import com.agribridge.backend.service.AdminDisputeService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/disputes")
@RequiredArgsConstructor
public class AdminDisputeController {

    private final AdminDisputeService adminDisputeService;
    private final AdminAuthorizationService adminAuthorizationService;

    @GetMapping
    public List<AdminDisputeDto> getDisputes(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        adminAuthorizationService.requireAdmin();
        return adminDisputeService.getDisputes(search, status);
    }

    @GetMapping("/{disputeId}")
    public AdminDisputeDto getDisputeById(@PathVariable Long disputeId) {
        adminAuthorizationService.requireAdmin();
        return adminDisputeService.getDisputeById(disputeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDisputeDto createDispute(@RequestBody AdminDisputeUpsertRequestDto request) {
        adminAuthorizationService.requireAdmin();
        return adminDisputeService.createDispute(
                request.getOrderId(),
                request.getBatchId(),
                request.getCreatedByUserId(),
                request.getAssignedToUserId(),
                request.getStatus(),
                request.getSeverity(),
                request.getTitle(),
                request.getDescription(),
                request.getResolution());
    }

    @PutMapping("/{disputeId}")
    public AdminDisputeDto updateDispute(
            @PathVariable Long disputeId,
            @RequestBody AdminDisputeUpsertRequestDto request) {
        adminAuthorizationService.requireAdmin();
        return adminDisputeService.updateDispute(
                disputeId,
                request.getOrderId(),
                request.getBatchId(),
                request.getCreatedByUserId(),
                request.getAssignedToUserId(),
                request.getStatus(),
                request.getSeverity(),
                request.getTitle(),
                request.getDescription(),
                request.getResolution());
    }

    @PatchMapping("/{disputeId}/status")
    public AdminDisputeDto updateDisputeStatus(
            @PathVariable Long disputeId,
            @RequestBody AdminDisputeStatusUpdateRequestDto request) {
        adminAuthorizationService.requireAdmin();
        if (request.getDecisionType() != null && !request.getDecisionType().isBlank()) {
            return adminDisputeService.resolveDispute(
                    disputeId,
                    request.getAssignedToUserId(),
                    request.getDecisionType(),
                    request.getRefundAmount(),
                    request.getCompensationAmount(),
                    request.getResolution(),
                    request.getReleaseRemainingToSupplier());
        }
        return adminDisputeService.updateDisputeStatus(
                disputeId,
                request.getAssignedToUserId(),
                request.getStatus(),
                request.getResolution());
    }

    @PostMapping("/{disputeId}/resolve")
    public AdminDisputeDto resolveDispute(
            @PathVariable Long disputeId,
            @RequestBody AdminDisputeResolveRequestDto request) {
        adminAuthorizationService.requireAdmin();
        return adminDisputeService.resolveDispute(
                disputeId,
                request.getAssignedToUserId(),
                request.getDecisionType(),
                request.getRefundAmount(),
                request.getCompensationAmount(),
                request.getResolution(),
                request.getReleaseRemainingToSupplier());
    }

    @PostMapping("/{disputeId}/refund")
    public Map<String, Object> refundDispute(
            @PathVariable Long disputeId,
            @RequestBody AdminDisputeRefundRequestDto request) {
        adminAuthorizationService.requireAdmin();
        adminDisputeService.refundDispute(disputeId, request.getRefundAmount(), request.getReason());
        return Map.of(
                "success", true,
                "message", "Hoàn tiền thành công");
    }

    @DeleteMapping("/{disputeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDispute(@PathVariable Long disputeId) {
        adminAuthorizationService.requireAdmin();
        adminDisputeService.deleteDispute(disputeId);
    }
}
