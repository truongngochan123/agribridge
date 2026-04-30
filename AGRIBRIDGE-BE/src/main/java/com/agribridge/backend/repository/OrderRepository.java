package com.agribridge.backend.repository;

import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    List<OrderEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);

    List<OrderEntity> findByBuyerCompanyIdOrderByCreatedAtDesc(Long buyerCompanyId);

    List<OrderEntity> findTop5ByBuyerCompanyIdAndBranchIdOrderByCreatedAtDesc(Long buyerCompanyId, Long branchId);

    boolean existsByBranchId(Long branchId);

    long countByBuyerCompanyIdAndBranchIdAndStatusIn(Long buyerCompanyId, Long branchId, Collection<OrderStatusEnum> statuses);

    @Query("""
            SELECT COUNT(o)
            FROM OrderEntity o
            WHERE o.buyerCompanyId = :buyerCompanyId
              AND o.branchId = :branchId
              AND o.createdAt >= :start
              AND o.createdAt < :end
            """)
    long countMonthlyByBranch(
            @Param("buyerCompanyId") Long buyerCompanyId,
            @Param("branchId") Long branchId,
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);

    @Query("""
            SELECT COALESCE(SUM(o.totalAmount), 0)
            FROM OrderEntity o
            WHERE o.buyerCompanyId = :buyerCompanyId
              AND o.branchId = :branchId
              AND o.createdAt >= :start
              AND o.createdAt < :end
            """)
    BigDecimal sumMonthlyTotalByBranch(
            @Param("buyerCompanyId") Long buyerCompanyId,
            @Param("branchId") Long branchId,
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);

    List<OrderEntity> findBySupplierCompanyIdAndBuyerCompanyId(Long supplierCompanyId, Long buyerCompanyId);

    List<OrderEntity> findByQuoteIdIn(Collection<Long> quoteIds);

    Optional<OrderEntity> findByQuoteId(Long quoteId);

    boolean existsByQuoteId(Long quoteId);
}
