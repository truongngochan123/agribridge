package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ComplaintEntity;
import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintRepository extends JpaRepository<ComplaintEntity, Long> {

    boolean existsByBatchIdIn(Collection<Long> batchIds);
}
