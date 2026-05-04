package com.agribridge.backend.repository;

import com.agribridge.backend.entity.MarketPriceSnapshotEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface MarketPriceSnapshotRepository extends JpaRepository<MarketPriceSnapshotEntity, Long> {

    boolean existsByProductId(Long productId);

    List<MarketPriceSnapshotEntity> findBySourceTypeIn(Collection<String> sourceTypes);

    List<MarketPriceSnapshotEntity> findBySourceTypeInAndPriceDateGreaterThanEqual(Collection<String> sourceTypes, LocalDate priceDate);

    Optional<MarketPriceSnapshotEntity> findByNormalizedProductNameAndCategoryIdAndRegionAndGradeAndSizeAndUnitAndPriceDateAndSourceType(
            String normalizedProductName,
            Long categoryId,
            String region,
            String grade,
            String size,
            String unit,
            LocalDate priceDate,
            String sourceType);

    List<MarketPriceSnapshotEntity> findByNormalizedProductNameAndRegionAndGradeAndSizeAndUnitAndSourceTypeOrderByPriceDateAsc(
            String normalizedProductName,
            String region,
            String grade,
            String size,
            String unit,
            String sourceType);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    void deleteBySourceTypeIn(Collection<String> sourceTypes);
}
