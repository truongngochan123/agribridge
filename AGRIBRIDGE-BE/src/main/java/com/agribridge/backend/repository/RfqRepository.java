package com.agribridge.backend.repository;

import com.agribridge.backend.entity.RfqEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RfqRepository extends JpaRepository<RfqEntity, Long> {

    List<RfqEntity> findByIdIn(Collection<Long> ids);
}
