package com.agribridge.backend.service;

import com.agribridge.backend.dto.CtaSummaryDto;
import com.agribridge.backend.dto.FeatureDto;
import com.agribridge.backend.dto.HeroStatsDto;
import com.agribridge.backend.dto.MarketPriceDto;
import com.agribridge.backend.dto.StepDto;
import com.agribridge.backend.dto.TestimonialDto;

import java.util.List;

public interface HomeService {
    HeroStatsDto getStats();

    List<FeatureDto> getFeatures();

    List<StepDto> getSteps();

    List<TestimonialDto> getTestimonials();

    List<MarketPriceDto> getMarketPrices();

    CtaSummaryDto getCtaSummary();
}
