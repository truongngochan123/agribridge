package com.agribridge.backend.repository;

import com.agribridge.backend.entity.InvoiceItemEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceItemRepository extends JpaRepository<InvoiceItemEntity, Long> {

    List<InvoiceItemEntity> findByInvoiceIdIn(Collection<Long> invoiceIds);
}
