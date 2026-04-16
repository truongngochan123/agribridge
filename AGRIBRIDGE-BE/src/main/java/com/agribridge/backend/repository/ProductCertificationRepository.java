package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ProductCertificationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductCertificationRepository extends JpaRepository<ProductCertificationEntity, Long> {

    List<ProductCertificationEntity> findByProduct_IdOrderByCreatedAtDesc(Long productId);

    void deleteByProduct_Id(Long productId);
}
