package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminOverviewActivityRequestDto;
import com.agribridge.backend.dto.AdminOverviewResponseDto;
import com.agribridge.backend.dto.AdminQuickStatRequestDto;
import com.agribridge.backend.service.AdminOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/overview")
@RequiredArgsConstructor
public class AdminOverviewController {

    private final AdminOverviewService adminOverviewService;

    @GetMapping
    public AdminOverviewResponseDto getOverview(@RequestParam(defaultValue = "30d") String filter) {
        return adminOverviewService.getOverview(filter);
    }

    @PostMapping("/activities")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminOverviewResponseDto.AdminActivityDto createActivity(@RequestBody AdminOverviewActivityRequestDto request) {
        return adminOverviewService.createActivity(request);
    }

    @PutMapping("/activities/{activityId}")
    public AdminOverviewResponseDto.AdminActivityDto updateActivity(
            @PathVariable Long activityId,
            @RequestBody AdminOverviewActivityRequestDto request) {
        return adminOverviewService.updateActivity(activityId, request);
    }

    @DeleteMapping("/activities/{activityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteActivity(@PathVariable Long activityId) {
        adminOverviewService.deleteActivity(activityId);
    }

    @PostMapping("/quick-stats")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminOverviewResponseDto.AdminQuickStatDto createQuickStat(@RequestBody AdminQuickStatRequestDto request) {
        return adminOverviewService.createQuickStat(request);
    }

    @PutMapping("/quick-stats/{statId}")
    public AdminOverviewResponseDto.AdminQuickStatDto updateQuickStat(
            @PathVariable Long statId,
            @RequestBody AdminQuickStatRequestDto request) {
        return adminOverviewService.updateQuickStat(statId, request);
    }

    @DeleteMapping("/quick-stats/{statId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuickStat(@PathVariable Long statId) {
        adminOverviewService.deleteQuickStat(statId);
    }
}
