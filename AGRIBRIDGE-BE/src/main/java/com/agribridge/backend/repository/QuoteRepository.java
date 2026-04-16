package com.agribridge.backend.repository;

import com.agribridge.backend.entity.QuoteEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuoteRepository extends JpaRepository<QuoteEntity, Long> {

    List<QuoteEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);

    List<QuoteEntity> findByRfqIdIn(Collection<Long> rfqIds);
}
