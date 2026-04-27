package com.agribridge.backend.repository;

import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RfqRepository extends JpaRepository<RfqEntity, Long> {

        List<RfqEntity> findByIdIn(Collection<Long> ids);

        boolean existsByProductId(Long productId);

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
