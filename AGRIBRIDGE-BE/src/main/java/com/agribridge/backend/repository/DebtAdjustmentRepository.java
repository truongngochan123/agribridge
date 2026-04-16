package com.agribridge.backend.repository;

import com.agribridge.backend.entity.DebtAdjustmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DebtAdjustmentRepository extends JpaRepository<DebtAdjustmentEntity, Long> {
}

