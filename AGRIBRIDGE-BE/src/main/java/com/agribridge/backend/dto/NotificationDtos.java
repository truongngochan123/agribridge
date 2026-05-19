package com.agribridge.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public record NotificationList(List<NotificationItem> items, long unreadCount) {
    }

    public record NotificationItem(
            Long id,
            String module,
            String type,
            String title,
            String body,
            String metadata,
            String actionUrl,
            String entityType,
            Long entityId,
            Boolean actionRequired,
            Boolean isRead,
            LocalDateTime createdAt
    ) {
    }
}
