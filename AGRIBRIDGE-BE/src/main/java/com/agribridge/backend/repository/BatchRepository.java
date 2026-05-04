package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BatchRepository extends JpaRepository<BatchEntity, Long> {

    List<BatchEntity> findByProductIdInOrderByCreatedAtDesc(Collection<Long> productIds);

    List<BatchEntity> findByProductIdOrderByCreatedAtDesc(Long productId);

    List<BatchEntity> findByProductIdAndStatusOrderByCreatedAtDesc(Long productId, BatchStatusEnum status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from BatchEntity b where b.id = :id")
    Optional<BatchEntity> findByIdForUpdate(@Param("id") Long id);
}
