package com.agribridge.backend.repository;

import com.agribridge.backend.entity.SupplierPayoutEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierPayoutRepository extends JpaRepository<SupplierPayoutEntity, Long> {

    List<SupplierPayoutEntity> findByOrderIdInOrderByCreatedAtAsc(Collection<Long> orderIds);

    Optional<SupplierPayoutEntity> findByOrderId(Long orderId);

    boolean existsByOrderId(Long orderId);
}
