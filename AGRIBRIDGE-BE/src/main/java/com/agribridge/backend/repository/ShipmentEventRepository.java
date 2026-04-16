package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentEventRepository extends JpaRepository<ShipmentEventEntity, Long> {
}

