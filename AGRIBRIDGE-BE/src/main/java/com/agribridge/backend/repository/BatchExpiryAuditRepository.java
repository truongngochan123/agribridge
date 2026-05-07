package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BatchExpiryAuditEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BatchExpiryAuditRepository extends JpaRepository<BatchExpiryAuditEntity, Long> {
}
