package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminDisputeDto;
import com.agribridge.backend.dto.AdminDisputeStatusUpdateRequestDto;
import com.agribridge.backend.dto.AdminDisputeUpsertRequestDto;
import com.agribridge.backend.service.AdminDisputeService;
import java.util.List;
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

    @GetMapping
    public List<AdminDisputeDto> getDisputes(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status) {
        return adminDisputeService.getDisputes(search, status);
    }

    @GetMapping("/{disputeId}")
    public AdminDisputeDto getDisputeById(@PathVariable Long disputeId) {
        return adminDisputeService.getDisputeById(disputeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDisputeDto createDispute(@RequestBody AdminDisputeUpsertRequestDto request) {
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
        return adminDisputeService.updateDisputeStatus(
                disputeId,
                request.getAssignedToUserId(),
                request.getStatus(),
                request.getResolution());
    }

    @DeleteMapping("/{disputeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDispute(@PathVariable Long disputeId) {
        adminDisputeService.deleteDispute(disputeId);
    }
}
