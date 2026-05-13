package com.agribridge.backend.repository;

import com.agribridge.backend.entity.DebtReminderEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DebtReminderRepository extends JpaRepository<DebtReminderEntity, Long> {

    List<DebtReminderEntity> findByInvoiceIdInOrderByCreatedAtDesc(Collection<Long> invoiceIds);

    List<DebtReminderEntity> findBySupplierCompanyIdAndBuyerCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId, Long buyerCompanyId);
}
