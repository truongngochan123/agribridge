package com.agribridge.backend.dto;

import java.time.LocalDateTime;

public final class AdminCategoryDtos {

    private AdminCategoryDtos() {
    }

    public record CategoryItem(
            Long id,
            String name,
            String description,
            Long userId,
            String scopeLabel,
            long productCount,
            LocalDateTime createdAt) {
    }

    public record CategoryRequest(String name, String description) {
    }
}
