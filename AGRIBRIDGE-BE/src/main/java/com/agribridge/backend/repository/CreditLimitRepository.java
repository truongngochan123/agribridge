package com.agribridge.backend.repository;

import com.agribridge.backend.entity.CreditLimitEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditLimitRepository extends JpaRepository<CreditLimitEntity, Long> {

    Optional<CreditLimitEntity> findBySupplierCompanyIdAndBuyerCompanyId(Long supplierCompanyId, Long buyerCompanyId);
}

