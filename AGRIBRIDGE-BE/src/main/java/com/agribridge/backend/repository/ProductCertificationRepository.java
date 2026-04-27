package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ProductCertificationEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductCertificationRepository extends JpaRepository<ProductCertificationEntity, Long> {

    List<ProductCertificationEntity> findByProduct_IdOrderByCreatedAtDesc(Long productId);

    List<ProductCertificationEntity> findByProduct_IdIn(Collection<Long> productIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ProductCertificationEntity certification where certification.product.id = :productId")
    void deleteByProduct_Id(@Param("productId") Long productId);
}
