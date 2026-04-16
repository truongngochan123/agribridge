package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CtaSummaryDto;
import com.agribridge.backend.dto.FeatureDto;
import com.agribridge.backend.dto.HeroStatsDto;
import com.agribridge.backend.dto.MarketPriceDto;
import com.agribridge.backend.dto.StepDto;
import com.agribridge.backend.dto.TestimonialDto;
import com.agribridge.backend.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    @GetMapping("/stats")
    public HeroStatsDto getStats() {
        return homeService.getStats();
    }

    @GetMapping("/features")
    public List<FeatureDto> getFeatures() {
        return homeService.getFeatures();
    }

    @GetMapping("/steps")
    public List<StepDto> getSteps() {
        return homeService.getSteps();
    }

    @GetMapping("/testimonials")
    public List<TestimonialDto> getTestimonials() {
        return homeService.getTestimonials();
    }

    @GetMapping("/market-prices")
    public List<MarketPriceDto> getMarketPrices() {
        return homeService.getMarketPrices();
    }

    @GetMapping("/cta-summary")
    public CtaSummaryDto getCtaSummary() {
        return homeService.getCtaSummary();
    }
}
