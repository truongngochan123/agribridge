package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CtaSummaryDto;
import com.agribridge.backend.dto.FeatureDto;
import com.agribridge.backend.dto.HeroStatsDto;
import com.agribridge.backend.dto.MarketPriceDto;
import com.agribridge.backend.dto.StepDto;
import com.agribridge.backend.dto.TestimonialDto;
import com.agribridge.backend.service.HomeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HomeControllerTest {

    @Mock
    private HomeService homeService;

    @InjectMocks
    private HomeController homeController;

    @Test
    void getStats_delegatesToService() {
        HeroStatsDto stats = HeroStatsDto.builder().supplierCount("1").build();
        when(homeService.getStats()).thenReturn(stats);

        HeroStatsDto result = homeController.getStats();

        assertThat(result).isEqualTo(stats);
        verify(homeService).getStats();
    }

    @Test
    void getCollectionEndpoints_delegateToService() {
        List<FeatureDto> features = List.of(FeatureDto.builder().id(1L).build());
        List<StepDto> steps = List.of(StepDto.builder().stepNumber("01").build());
        List<TestimonialDto> testimonials = List.of(TestimonialDto.builder().id(1L).build());
        List<MarketPriceDto> prices = List.of(MarketPriceDto.builder().id(1L).build());

        when(homeService.getFeatures()).thenReturn(features);
        when(homeService.getSteps()).thenReturn(steps);
        when(homeService.getTestimonials()).thenReturn(testimonials);
        when(homeService.getMarketPrices()).thenReturn(prices);

        assertThat(homeController.getFeatures()).isEqualTo(features);
        assertThat(homeController.getSteps()).isEqualTo(steps);
        assertThat(homeController.getTestimonials()).isEqualTo(testimonials);
        assertThat(homeController.getMarketPrices()).isEqualTo(prices);

        verify(homeService).getFeatures();
        verify(homeService).getSteps();
        verify(homeService).getTestimonials();
        verify(homeService).getMarketPrices();
    }

    @Test
    void getCtaSummary_delegatesToService() {
        CtaSummaryDto summary = CtaSummaryDto.builder().build();
        when(homeService.getCtaSummary()).thenReturn(summary);

        CtaSummaryDto result = homeController.getCtaSummary();

        assertThat(result).isEqualTo(summary);
        verify(homeService).getCtaSummary();
    }
}
