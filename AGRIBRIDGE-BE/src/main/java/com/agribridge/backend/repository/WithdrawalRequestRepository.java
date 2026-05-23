package com.agribridge.backend.repository;

import com.agribridge.backend.entity.WithdrawalRequestEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WithdrawalRequestRepository extends JpaRepository<WithdrawalRequestEntity, Long> {
    List<WithdrawalRequestEntity> findBySupplierCompanyIdOrderByRequestedAtDesc(Long supplierCompanyId);

    List<WithdrawalRequestEntity> findAllByOrderByRequestedAtDesc();
}
