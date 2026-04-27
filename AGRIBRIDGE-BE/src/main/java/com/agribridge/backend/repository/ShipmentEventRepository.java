package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentEventEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentEventRepository extends JpaRepository<ShipmentEventEntity, Long> {

    List<ShipmentEventEntity> findByShipmentIdOrderByEventTimeAsc(Long shipmentId);
}

