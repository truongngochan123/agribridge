package com.agribridge.backend.controller;

import com.agribridge.backend.dto.NotificationDtos;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.DebtReminderEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.DebtReminderRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
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
    private final DebtReminderRepository debtReminderRepository;
    private final CompanyRepository companyRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    @Transactional
    public NotificationDtos.NotificationList getNotifications() {
        UserEntity user = currentUserService.requireCurrentUser();
        Long companyId = user.getCompanyId();
        if (companyId != null) {
            backfillDebtReminderNotifications(user, companyId);
        }
        return new NotificationDtos.NotificationList(
                (companyId == null
                        ? notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                        : notificationRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)).stream()
                        .map(this::toItem)
                        .toList(),
                companyId == null
                        ? notificationRepository.countByUserIdAndIsReadFalse(user.getId())
                        : notificationRepository.countByCompanyIdAndIsReadFalse(companyId));
    }

    @PostMapping("/{notificationId}/read")
    public NotificationDtos.NotificationList markAsRead(@PathVariable Long notificationId) {
        UserEntity user = currentUserService.requireCurrentUser();
        Long companyId = user.getCompanyId();
        var notification = companyId == null
                ? notificationRepository.findByIdAndUserId(notificationId, user.getId())
                : notificationRepository.findByIdAndCompanyId(notificationId, companyId);
        notification.ifPresent(item -> {
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
        Long companyId = user.getCompanyId();
        if (companyId != null) {
            backfillDebtReminderNotifications(user, companyId);
        }
        var unreadItems = companyId == null
                ? notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(user.getId())
                : notificationRepository.findByCompanyIdAndIsReadFalseOrderByCreatedAtDesc(companyId);
        unreadItems.forEach(item -> item.setIsRead(Boolean.TRUE));
        notificationRepository.saveAll(unreadItems);
        return getNotifications();
    }

    private NotificationDtos.NotificationItem toItem(NotificationEntity item) {
        Map<String, Object> metadata = parseMetadata(item.getMetadata());
        return new NotificationDtos.NotificationItem(
                item.getId(),
                stringValue(metadata.get("module"), inferModule(item)),
                item.getType() == null ? null : item.getType().name(),
                item.getTitle(),
                item.getBody(),
                item.getMetadata(),
                stringValue(metadata.get("actionUrl"), stringValue(metadata.get("route"), null)),
                stringValue(metadata.get("entityType"), item.getRefTable()),
                numberValue(metadata.get("entityId"), item.getRefId()),
                booleanValue(metadata.get("actionRequired")),
                item.getIsRead(),
                item.getCreatedAt());
    }

    private void backfillDebtReminderNotifications(UserEntity user, Long companyId) {
        List<DebtReminderEntity> reminders = debtReminderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(companyId);
        if (reminders.isEmpty()) return;

        List<Long> reminderIds = reminders.stream()
                .map(DebtReminderEntity::getId)
                .toList();
        Set<Long> existingReminderIds = notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefIdIn(
                        companyId,
                        NotificationTypeEnum.DEBT_REMINDER,
                        "debt_reminders",
                        reminderIds)
                .stream()
                .map(NotificationEntity::getRefId)
                .collect(Collectors.toSet());

        List<NotificationEntity> missingNotifications = reminders.stream()
                .filter(reminder -> reminder.getId() != null && !existingReminderIds.contains(reminder.getId()))
                .map(reminder -> toDebtReminderNotification(user, companyId, reminder))
                .toList();
        if (!missingNotifications.isEmpty()) {
            notificationRepository.saveAll(missingNotifications);
        }
    }

    private NotificationEntity toDebtReminderNotification(UserEntity user, Long companyId, DebtReminderEntity reminder) {
        String supplierName = companyRepository.findById(reminder.getSupplierCompanyId())
                .map(CompanyEntity::getName)
                .filter(name -> !name.isBlank())
                .orElse("Nhà cung cấp");
        String actionUrl = "/buyer/debt?supplierId=" + reminder.getSupplierCompanyId()
                + (reminder.getInvoiceId() == null ? "" : "&invoiceId=" + reminder.getInvoiceId());
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("role", "buyer");
        metadata.put("module", "DEBT");
        metadata.put("actionUrl", actionUrl);
        metadata.put("route", actionUrl);
        metadata.put("entityType", "debt_reminders");
        metadata.put("entityId", reminder.getId());
        metadata.put("actionRequired", true);
        metadata.put("type", NotificationTypeEnum.DEBT_REMINDER.name());
        metadata.put("invoiceId", reminder.getInvoiceId());
        metadata.put("orderId", reminder.getOrderId());
        metadata.put("supplierCompanyId", reminder.getSupplierCompanyId());
        metadata.put("supplierName", supplierName);
        metadata.put("buyerCompanyId", reminder.getBuyerCompanyId());
        metadata.put("amount", reminder.getAmount());

        return NotificationEntity.builder()
                .userId(user.getId())
                .companyId(companyId)
                .type(NotificationTypeEnum.DEBT_REMINDER)
                .title("Nhắc thanh toán công nợ")
                .body(stringValue(reminder.getMessage(), supplierName + " nhắc bạn thanh toán công nợ."))
                .metadata(toJson(metadata))
                .refTable("debt_reminders")
                .refId(reminder.getId())
                .isRead(Boolean.FALSE)
                .createdAt(firstDateTime(reminder.getSentAt(), reminder.getCreatedAt(), LocalDateTime.now()))
                .build();
    }

    private String toJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private Map<String, Object> parseMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(metadata, new TypeReference<>() {
            });
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private String inferModule(NotificationEntity item) {
        if (item.getType() == null) return "SYSTEM";
        String type = item.getType().name();
        if (type.startsWith("ORDER_")) return "ORDER";
        if (type.startsWith("PAYMENT_")) return "PAYMENT";
        if (type.startsWith("DELIVERY_")) return "DELIVERY";
        if (type.startsWith("RFQ_")) return "RFQ";
        if (type.startsWith("COMPLAINT_")) return "COMPLAINT";
        if (type.startsWith("DEBT_")) return "DEBT";
        return "SYSTEM";
    }

    private String stringValue(Object value, String fallback) {
        return value instanceof String text && !text.isBlank() ? text : fallback;
    }

    private LocalDateTime firstDateTime(LocalDateTime value, LocalDateTime fallback, LocalDateTime defaultValue) {
        if (value != null) return value;
        if (fallback != null) return fallback;
        return defaultValue;
    }

    private Long numberValue(Object value, Long fallback) {
        if (value instanceof Number number) return number.longValue();
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private Boolean booleanValue(Object value) {
        return value instanceof Boolean bool ? bool : Boolean.FALSE;
    }
}
