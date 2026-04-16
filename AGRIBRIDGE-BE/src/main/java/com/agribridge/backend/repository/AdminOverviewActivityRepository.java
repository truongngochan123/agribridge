package com.agribridge.backend.repository;

import com.agribridge.backend.entity.AdminOverviewActivityEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminOverviewActivityRepository extends JpaRepository<AdminOverviewActivityEntity, Long> {

    List<AdminOverviewActivityEntity> findAllByOrderBySortOrderAscIdAsc();
}
