package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CtaSummaryDto;
import com.agribridge.backend.dto.MarketPriceDto;
import com.agribridge.backend.entity.MarketPriceEntity;
import com.agribridge.backend.repository.MarketPriceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HomeServiceImplTest {

    @Mock
    private MarketPriceRepository marketPriceRepository;

    @InjectMocks
    private HomeServiceImpl homeService;

    @Test
    void getFeatures_returnsExpectedStaticFeatureList() {
        var features = homeService.getFeatures();

        assertThat(features).hasSize(4);
        assertThat(features.get(0).title()).isEqualTo("Tạo RFQ & Báo giá thông minh");
        assertThat(features.get(3).icon()).isEqualTo("Truck");
    }

    @Test
    void getMarketPrices_mapsRepositoryEntitiesToDtos() {
        var entity = MarketPriceEntity.builder()
                .id(99L)
                .name("Gao ST25")
                .image("/images/rice.jpg")
                .price("32000")
                .unit("kg")
                .region("Soc Trang")
                .trend("+0.8%")
                .build();
        when(marketPriceRepository.findAll()).thenReturn(List.of(entity));

        List<MarketPriceDto> result = homeService.getMarketPrices();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(99L);
        assertThat(result.get(0).name()).isEqualTo("Gao ST25");
        assertThat(result.get(0).trend()).isEqualTo("+0.8%");
    }

    @Test
    void getCtaSummary_returnsSupplierAndBuyerBlocks() {
        CtaSummaryDto summary = homeService.getCtaSummary();

        assertThat(summary.supplier()).isNotNull();
        assertThat(summary.buyer()).isNotNull();
        assertThat(summary.supplier().stats()).hasSize(3);
        assertThat(summary.buyer().stats()).contains("24/7 Hỗ trợ");
    }
}
