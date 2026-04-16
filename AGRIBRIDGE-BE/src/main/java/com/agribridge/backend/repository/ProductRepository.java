package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ProductEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<ProductEntity, Long> {

    List<ProductEntity> findBySupplierCompanyIdOrderByCreatedAtDesc(Long supplierCompanyId);

    List<ProductEntity> findBySupplierCompanyId(Long supplierCompanyId);

    List<ProductEntity> findByIdIn(Collection<Long> ids);
}
