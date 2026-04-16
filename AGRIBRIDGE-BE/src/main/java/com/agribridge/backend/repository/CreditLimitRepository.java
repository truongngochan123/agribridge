package com.agribridge.backend.repository;

import com.agribridge.backend.entity.CreditLimitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditLimitRepository extends JpaRepository<CreditLimitEntity, Long> {
}

