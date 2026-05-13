package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentIncidentEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentIncidentRepository extends JpaRepository<ShipmentIncidentEntity, Long> {

    List<ShipmentIncidentEntity> findByShipmentIdInOrderByCreatedAtDesc(Collection<Long> shipmentIds);

    List<ShipmentIncidentEntity> findByShipmentIdOrderByCreatedAtDesc(Long shipmentId);

    boolean existsByShipmentIdAndStatusIn(Long shipmentId, Collection<String> statuses);
}
