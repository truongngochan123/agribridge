package com.agribridge.backend.repository;

import com.agribridge.backend.entity.InvoiceEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, Long> {

    List<InvoiceEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);
}
