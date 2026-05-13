package com.agribridge.backend.controller;

import com.agribridge.backend.dto.NotificationDtos;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final CurrentUserService currentUserService;
    private final NotificationRepository notificationRepository;

    @GetMapping
    public NotificationDtos.NotificationList getNotifications() {
        UserEntity user = currentUserService.requireCurrentUser();
        return new NotificationDtos.NotificationList(
                notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                        .map(this::toItem)
                        .toList(),
                notificationRepository.countByUserIdAndIsReadFalse(user.getId()));
    }

    @PostMapping("/{notificationId}/read")
    public NotificationDtos.NotificationList markAsRead(@PathVariable Long notificationId) {
        UserEntity user = currentUserService.requireCurrentUser();
        notificationRepository.findByIdAndUserId(notificationId, user.getId()).ifPresent(item -> {
            if (!Boolean.TRUE.equals(item.getIsRead())) {
                item.setIsRead(Boolean.TRUE);
                notificationRepository.save(item);
            }
        });
        return getNotifications();
    }

    @PostMapping("/read-all")
    public NotificationDtos.NotificationList markAllAsRead() {
        UserEntity user = currentUserService.requireCurrentUser();
        var unreadItems = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(user.getId());
        unreadItems.forEach(item -> item.setIsRead(Boolean.TRUE));
        notificationRepository.saveAll(unreadItems);
        return getNotifications();
    }

    private NotificationDtos.NotificationItem toItem(NotificationEntity item) {
        return new NotificationDtos.NotificationItem(
                item.getId(),
                item.getType() == null ? null : item.getType().name(),
                item.getTitle(),
                item.getBody(),
                item.getMetadata(),
                item.getIsRead(),
                item.getCreatedAt());
    }
}
