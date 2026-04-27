package com.agribridge.backend.repository;

import com.agribridge.backend.entity.QcRecordEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QcRecordRepository extends JpaRepository<QcRecordEntity, Long> {

	Optional<QcRecordEntity> findTopByBatchIdOrderByCreatedAtDesc(Long batchId);

	List<QcRecordEntity> findByBatchIdOrderByCreatedAtDesc(Long batchId);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("delete from QcRecordEntity record where record.batchId = :batchId")
	void deleteByBatchId(@Param("batchId") Long batchId);
}
