package com.agribridge.backend.repository;

import com.agribridge.backend.entity.MarketPriceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketPriceRepository extends JpaRepository<MarketPriceEntity, Long> {
}
