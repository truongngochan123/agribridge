package com.agribridge.backend.repository;

import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RfqRepository extends JpaRepository<RfqEntity, Long> {

        List<RfqEntity> findByIdIn(Collection<Long> ids);

        boolean existsByProductId(Long productId);

        Optional<RfqEntity> findByIdAndBuyerCompanyId(Long id, Long buyerCompanyId);

        List<RfqEntity> findTop5ByBuyerCompanyIdAndBranchIdOrderByCreatedAtDesc(Long buyerCompanyId, Long branchId);

        boolean existsByBranchId(Long branchId);

        long countByBuyerCompanyIdAndBranchIdAndStatus(Long buyerCompanyId, Long branchId, RfqStatusEnum status);

        @Query("""
                        SELECT r
                        FROM RfqEntity r
                        LEFT JOIN r.product p
                        WHERE r.buyerCompanyId = :buyerCompanyId
                          AND (:status IS NULL OR r.status = :status)
                          AND (
                                :keyword IS NULL
                             OR LOWER(r.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
                             OR LOWER(COALESCE(r.description, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                             OR LOWER(COALESCE(r.province, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                             OR LOWER(COALESCE(p.name, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                          )
                        ORDER BY r.createdAt DESC, r.id DESC
                        """)
        Page<RfqEntity> findByBuyerCompanyIdForBuyerPage(
                        @Param("buyerCompanyId") Long buyerCompanyId,
                        @Param("status") RfqStatusEnum status,
                        @Param("keyword") String keyword,
                        Pageable pageable);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("update RfqEntity rfq set rfq.productId = null where rfq.productId = :productId")
        int clearProductReference(@Param("productId") Long productId);

        @Query("""
                        SELECT r
                        FROM RfqEntity r
                        WHERE r.status = :status
                          AND (r.expiredAt IS NULL OR r.expiredAt > :now)
                          AND (
                                (:matchCategories = true AND r.categoryId IN :categoryIds)
                             OR (:matchProducts = true AND r.productId IN :productIds)
                             OR (:matchProvinces = true AND LOWER(r.province) IN :provinces)
                          )
                        ORDER BY r.createdAt DESC, r.id DESC
                        """)
        List<RfqEntity> findRelevantOpenRfqs(
                        @Param("status") RfqStatusEnum status,
                        @Param("now") LocalDateTime now,
                        @Param("matchCategories") boolean matchCategories,
                        @Param("categoryIds") Collection<Long> categoryIds,
                        @Param("matchProducts") boolean matchProducts,
                        @Param("productIds") Collection<Long> productIds,
                        @Param("matchProvinces") boolean matchProvinces,
                        @Param("provinces") Collection<String> provinces);
}
