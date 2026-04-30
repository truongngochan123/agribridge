package com.agribridge.backend.repository;

import com.agribridge.backend.entity.BranchEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BranchRepository extends JpaRepository<BranchEntity, Long> {

    List<BranchEntity> findByIdIn(Collection<Long> ids);

    Optional<BranchEntity> findByIdAndCompanyId(Long id, Long companyId);
}
