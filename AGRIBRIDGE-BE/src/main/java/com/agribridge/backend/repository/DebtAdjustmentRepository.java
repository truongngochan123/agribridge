package com.agribridge.backend.repository;

import com.agribridge.backend.entity.DebtAdjustmentEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DebtAdjustmentRepository extends JpaRepository<DebtAdjustmentEntity, Long> {

    List<DebtAdjustmentEntity> findByInvoiceIdInOrderByCreatedAtDesc(Collection<Long> invoiceIds);
}

