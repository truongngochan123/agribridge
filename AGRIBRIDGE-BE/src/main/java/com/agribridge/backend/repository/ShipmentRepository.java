package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {

    List<ShipmentEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);

    List<ShipmentEntity> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    Optional<ShipmentEntity> findTopByOrderIdOrderByCreatedAtDesc(Long orderId);
}
