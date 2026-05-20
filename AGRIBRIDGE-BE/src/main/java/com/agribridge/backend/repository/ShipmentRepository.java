package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {

    List<ShipmentEntity> findByOrderIdInOrderByCreatedAtDesc(Collection<Long> orderIds);

    List<ShipmentEntity> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    Optional<ShipmentEntity> findTopByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<ShipmentEntity> findByStatusInAndAutoProgressEnabledTrueOrderByLastStatusChangedAtAsc(
            Collection<ShipmentStatusEnum> statuses);

    @Query("""
            SELECT s
            FROM ShipmentEntity s
            JOIN OrderEntity o ON o.id = s.orderId
            LEFT JOIN BranchEntity b ON b.id = o.branchId
            LEFT JOIN CompanyEntity c ON c.id = o.supplierCompanyId
            WHERE o.buyerCompanyId = :buyerCompanyId
              AND (:branchId IS NULL OR o.branchId = :branchId)
              AND (:status IS NULL OR s.status = :status)
              AND (:fromDate IS NULL OR s.createdAt >= :fromDate)
              AND (:toDate IS NULL OR s.createdAt < :toDate)
              AND (
                    :keyword IS NULL
                 OR LOWER(COALESCE(s.trackingCode, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(COALESCE(c.name, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(COALESCE(b.name, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(COALESCE(s.receiverAddress, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                 OR LOWER(CONCAT('ORD-', o.id)) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            ORDER BY s.createdAt DESC, s.id DESC
            """)
    List<ShipmentEntity> findBuyerShipments(
            @Param("buyerCompanyId") Long buyerCompanyId,
            @Param("branchId") Long branchId,
            @Param("status") ShipmentStatusEnum status,
            @Param("keyword") String keyword,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate);
}
