package com.agribridge.backend.repository;

import com.agribridge.backend.entity.OrderItemEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItemEntity, Long> {

    List<OrderItemEntity> findByOrderIdIn(Collection<Long> orderIds);

    List<OrderItemEntity> findByOrderIdOrderByIdAsc(Long orderId);

    boolean existsByBatchIdIn(Collection<Long> batchIds);

    boolean existsByBatchId(Long batchId);
}
