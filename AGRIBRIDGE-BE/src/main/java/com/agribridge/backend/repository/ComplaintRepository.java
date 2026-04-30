package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ComplaintEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintRepository extends JpaRepository<ComplaintEntity, Long> {

    boolean existsByBatchIdIn(Collection<Long> batchIds);

    List<ComplaintEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);

    List<ComplaintEntity> findByOrderIdOrderByCreatedAtDesc(Long orderId);
}
