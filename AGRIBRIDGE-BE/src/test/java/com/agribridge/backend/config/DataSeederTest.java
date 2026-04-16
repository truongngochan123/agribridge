package com.agribridge.backend.config;

import com.agribridge.backend.entity.MarketPriceEntity;
import com.agribridge.backend.repository.MarketPriceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertFalse;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings({ "unchecked", "null" })
class DataSeederTest {

    @Mock
    private MarketPriceRepository marketPriceRepository;

    @Test
    void seedMarketPrices_skipsWhenDataAlreadyExists() throws Exception {
        when(marketPriceRepository.count()).thenReturn(1L);
        DataSeeder dataSeeder = new DataSeeder(marketPriceRepository);

        dataSeeder.seedMarketPrices().run();

        verify(marketPriceRepository).count();
        verifyNoMoreInteractions(marketPriceRepository);
    }

    @Test
    void seedMarketPrices_insertsDefaultDataWhenRepositoryEmpty() throws Exception {
        when(marketPriceRepository.count()).thenReturn(0L);
        DataSeeder dataSeeder = new DataSeeder(marketPriceRepository);

        dataSeeder.seedMarketPrices().run();

        ArgumentCaptor<Iterable<MarketPriceEntity>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(marketPriceRepository, times(1)).saveAll(captor.capture());
        List<MarketPriceEntity> captured = new ArrayList<>();
        captor.getValue().forEach(captured::add);
        assertFalse(captured.isEmpty());
    }
}
