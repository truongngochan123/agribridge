package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BatchImageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BatchImageRepository extends JpaRepository<BatchImageEntity, Long> {

	List<BatchImageEntity> findByBatchIdOrderByUploadedAtDesc(Long batchId);

	void deleteByBatchId(Long batchId);
}
