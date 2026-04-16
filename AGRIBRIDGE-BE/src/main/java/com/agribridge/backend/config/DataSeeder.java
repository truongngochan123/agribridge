package com.agribridge.backend.config;

import com.agribridge.backend.entity.MarketPriceEntity;
import com.agribridge.backend.repository.MarketPriceRepository;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class DataSeeder {

    private final MarketPriceRepository marketPriceRepository;

    public DataSeeder(MarketPriceRepository marketPriceRepository) {
        this.marketPriceRepository = marketPriceRepository;
    }

    @Bean
    public CommandLineRunner seedMarketPrices() {
        return args -> {
            if (marketPriceRepository.count() > 0) {
                return;
            }

            List<MarketPriceEntity> defaults = List.of(
                    MarketPriceEntity.builder()
                            .name("Tom Su Huu Co")
                            .image("https://example.com/tom-su.jpg")
                            .price("285,000d")
                            .unit("kg")
                            .region("Mien Nam")
                            .trend("up")
                            .build(),
                    MarketPriceEntity.builder()
                            .name("Ca Tra Phi Le")
                            .image("https://example.com/ca-tra.jpg")
                            .price("68,000d")
                            .unit("kg")
                            .region("Mien Tay")
                            .trend("stable")
                            .build());

            marketPriceRepository.saveAll(Objects.requireNonNull(defaults));
        };
    }
}
