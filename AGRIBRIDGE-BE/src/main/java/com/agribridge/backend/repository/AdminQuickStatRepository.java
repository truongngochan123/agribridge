package com.agribridge.backend.repository;

import com.agribridge.backend.entity.AdminQuickStatEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminQuickStatRepository extends JpaRepository<AdminQuickStatEntity, Long> {

    List<AdminQuickStatEntity> findAllByOrderBySortOrderAscIdAsc();
}
