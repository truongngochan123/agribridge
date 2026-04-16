package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ComplaintEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintRepository extends JpaRepository<ComplaintEntity, Long> {
}
