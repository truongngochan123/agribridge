package com.agribridge.backend.repository;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, Long> {

    List<InvoiceEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);

    Optional<InvoiceEntity> findTopByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<InvoiceEntity> findByStatusInAndDueDateBefore(Collection<InvoiceStatusEnum> statuses, java.time.LocalDate dueDate);
}
