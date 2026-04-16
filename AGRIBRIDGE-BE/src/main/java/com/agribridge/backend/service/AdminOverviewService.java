package com.agribridge.backend.service;

import com.agribridge.backend.dto.AdminOverviewActivityRequestDto;
import com.agribridge.backend.dto.AdminOverviewResponseDto;
import com.agribridge.backend.dto.AdminQuickStatRequestDto;

public interface AdminOverviewService {

    AdminOverviewResponseDto getOverview(String filter);

    AdminOverviewResponseDto.AdminActivityDto createActivity(AdminOverviewActivityRequestDto request);

    AdminOverviewResponseDto.AdminActivityDto updateActivity(Long activityId, AdminOverviewActivityRequestDto request);

    void deleteActivity(Long activityId);

    AdminOverviewResponseDto.AdminQuickStatDto createQuickStat(AdminQuickStatRequestDto request);

    AdminOverviewResponseDto.AdminQuickStatDto updateQuickStat(Long statId, AdminQuickStatRequestDto request);

    void deleteQuickStat(Long statId);
}
