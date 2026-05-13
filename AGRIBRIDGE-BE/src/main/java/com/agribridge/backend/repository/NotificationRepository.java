package com.agribridge.backend.repository;

import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

    List<NotificationEntity> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(Long userId);

    java.util.Optional<NotificationEntity> findByIdAndUserId(Long id, Long userId);

    List<NotificationEntity> findByCompanyIdAndTypeAndRefTableAndRefIdIn(
            Long companyId,
            NotificationTypeEnum type,
            String refTable,
            java.util.Collection<Long> refIds
    );

    List<NotificationEntity> findByCompanyIdAndTypeAndRefTableAndRefId(
            Long companyId,
            NotificationTypeEnum type,
            String refTable,
            Long refId
    );
}

