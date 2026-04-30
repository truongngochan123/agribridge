package com.agribridge.backend.repository;

import com.agribridge.backend.entity.OrderEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    List<OrderEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);

    List<OrderEntity> findByBuyerCompanyIdOrderByCreatedAtDesc(Long buyerCompanyId);

    List<OrderEntity> findBySupplierCompanyIdAndBuyerCompanyId(Long supplierCompanyId, Long buyerCompanyId);

    List<OrderEntity> findByQuoteIdIn(Collection<Long> quoteIds);

    Optional<OrderEntity> findByQuoteId(Long quoteId);

    boolean existsByQuoteId(Long quoteId);
}
