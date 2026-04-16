package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BranchEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BranchRepository extends JpaRepository<BranchEntity, Long> {

    List<BranchEntity> findByIdIn(Collection<Long> ids);
}
