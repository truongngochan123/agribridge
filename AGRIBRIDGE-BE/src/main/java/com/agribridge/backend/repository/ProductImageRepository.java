package com.agribridge.backend.repository;

import com.agribridge.backend.entity.ProductImageEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductImageRepository extends JpaRepository<ProductImageEntity, Long> {

    List<ProductImageEntity> findByProductIdIn(Collection<Long> productIds);

    List<ProductImageEntity> findByProductIdOrderByUploadedAtDesc(Long productId);

    Optional<ProductImageEntity> findTopByProductIdOrderByUploadedAtDesc(Long productId);

    void deleteByProductId(Long productId);
}
