package com.agribridge.backend.repository;

import com.agribridge.backend.entity.QcRecordEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QcRecordRepository extends JpaRepository<QcRecordEntity, Long> {

	Optional<QcRecordEntity> findTopByBatchIdOrderByCreatedAtDesc(Long batchId);

	List<QcRecordEntity> findByBatchIdOrderByCreatedAtDesc(Long batchId);
}
