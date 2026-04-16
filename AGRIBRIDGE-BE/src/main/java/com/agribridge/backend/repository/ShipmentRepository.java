package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {

    List<ShipmentEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);
}
