package com.agribridge.backend.repository;

import com.agribridge.backend.entity.OrderEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    List<OrderEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);
}
