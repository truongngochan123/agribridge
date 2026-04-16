package com.agribridge.backend.repository;

import com.agribridge.backend.entity.MarketPriceSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketPriceSnapshotRepository extends JpaRepository<MarketPriceSnapshotEntity, Long> {
}

