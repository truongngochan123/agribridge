package com.agribridge.backend.repository;

import com.agribridge.backend.entity.QuoteEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuoteRepository extends JpaRepository<QuoteEntity, Long> {

    List<QuoteEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);

    List<QuoteEntity> findByRfqIdIn(Collection<Long> rfqIds);

    List<QuoteEntity> findByRfqIdOrderByCreatedAtDesc(Long rfqId);

    Optional<QuoteEntity> findByIdAndRfqId(Long id, Long rfqId);

    long countByRfqId(Long rfqId);

    boolean existsByBatchIdIn(Collection<Long> batchIds);

    Optional<QuoteEntity> findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(Long supplierCompanyId, Long rfqId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE QuoteEntity q
            SET q.status = :status
            WHERE q.rfqId = :rfqId
              AND q.id <> :selectedQuoteId
              AND UPPER(q.status) NOT IN :terminalStatuses
            """)
    int updateOtherQuotesStatus(
            @Param("rfqId") Long rfqId,
            @Param("selectedQuoteId") Long selectedQuoteId,
            @Param("status") String status,
            @Param("terminalStatuses") Collection<String> terminalStatuses);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE QuoteEntity q
            SET q.status = :status
            WHERE q.rfqId = :rfqId
              AND UPPER(q.status) IN :currentStatuses
            """)
    int updateStatusesByRfqId(
            @Param("rfqId") Long rfqId,
            @Param("currentStatuses") Collection<String> currentStatuses,
            @Param("status") String status);
}
