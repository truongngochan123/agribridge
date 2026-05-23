package com.agribridge.backend.repository;

import com.agribridge.backend.entity.RfqMessageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RfqMessageRepository extends JpaRepository<RfqMessageEntity, Long> {

    List<RfqMessageEntity> findByRfqIdOrderByCreatedAtAsc(Long rfqId);

    List<RfqMessageEntity> findByRfqIdAndSupplierCompanyIdOrderByCreatedAtAsc(Long rfqId, Long supplierCompanyId);
}
