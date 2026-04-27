package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ProductImageEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductImageRepository extends JpaRepository<ProductImageEntity, Long> {

    List<ProductImageEntity> findByProductIdIn(Collection<Long> productIds);

    List<ProductImageEntity> findByProductIdOrderByUploadedAtDesc(Long productId);

    Optional<ProductImageEntity> findTopByProductIdOrderByUploadedAtDesc(Long productId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ProductImageEntity image where image.productId = :productId")
    void deleteByProductId(@Param("productId") Long productId);
}
