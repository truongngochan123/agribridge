package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BatchRepository extends JpaRepository<BatchEntity, Long> {

    List<BatchEntity> findByProductIdInOrderByCreatedAtDesc(Collection<Long> productIds);

    List<BatchEntity> findByProductIdOrderByCreatedAtDesc(Long productId);

    List<BatchEntity> findByProductIdAndStatusOrderByCreatedAtDesc(Long productId, BatchStatusEnum status);
}
