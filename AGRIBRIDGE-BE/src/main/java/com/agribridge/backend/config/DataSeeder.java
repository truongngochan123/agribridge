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
                            .name("Tôm Sú Hữu Cơ")
                            .image("https://example.com/tom-su.jpg")
                            .price("285,000đ")
                            .unit("kg")
                            .region("Miền Nam")
                            .trend("up")
                            .build(),
                    MarketPriceEntity.builder()
                            .name("Cá Tra Phi Lê")
                            .image("https://example.com/ca-tra.jpg")
                            .price("68,000đ")
                            .unit("kg")
                            .region("Miền Tây")
                            .trend("stable")
                            .build());

            marketPriceRepository.saveAll(Objects.requireNonNull(defaults));
        };
    }
}
