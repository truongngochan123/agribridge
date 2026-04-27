package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BatchImageEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BatchImageRepository extends JpaRepository<BatchImageEntity, Long> {

	List<BatchImageEntity> findByBatchIdOrderByUploadedAtDesc(Long batchId);

	List<BatchImageEntity> findByBatchIdInOrderByUploadedAtDesc(Collection<Long> batchIds);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("delete from BatchImageEntity image where image.batchId = :batchId")
	void deleteByBatchId(@Param("batchId") Long batchId);
}
