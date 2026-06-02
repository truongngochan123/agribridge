package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CtaBlockDto;
import com.agribridge.backend.dto.CtaSummaryDto;
import com.agribridge.backend.dto.FeatureDto;
import com.agribridge.backend.dto.HeroStatsDto;
import com.agribridge.backend.dto.MarketPriceDto;
import com.agribridge.backend.dto.StepDto;
import com.agribridge.backend.dto.TestimonialDto;
import com.agribridge.backend.entity.MarketPriceEntity;
import com.agribridge.backend.entity.MarketPriceSnapshotEntity;
import com.agribridge.backend.entity.ProductImageEntity;
import com.agribridge.backend.repository.MarketPriceRepository;
import com.agribridge.backend.repository.MarketPriceSnapshotRepository;
import com.agribridge.backend.repository.ProductImageRepository;
import com.agribridge.backend.service.MarketPriceAggregationService;
import com.agribridge.backend.service.HomeService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Comparator;
import java.util.LinkedHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Slf4j
public class HomeServiceImpl implements HomeService {

    private final MarketPriceRepository marketPriceRepository;
    private final MarketPriceSnapshotRepository marketPriceSnapshotRepository;
    private final ProductImageRepository productImageRepository;
    private final MarketPriceAggregationService marketPriceAggregationService;

    @Override
    public HeroStatsDto getStats() {
        log.info("Loading home hero stats");
        HeroStatsDto stats = HeroStatsDto.builder()
                .supplierCount("2,500+")
                .buyerCount("8,000+")
                .transactionValue("50 ty")
                .rfqCount("15,000+")
                .build();
        log.info("Loaded home hero stats");
        return stats;
    }

    @Override
    public List<FeatureDto> getFeatures() {
        log.info("Loading home features");
        List<FeatureDto> features = List.of(
                FeatureDto.builder().id(1L).icon("FileSearch").title("Tạo RFQ & Báo giá thông minh")
                        .description("Nhận báo giá nhanh theo lô hàng, tối ưu thời gian thu mua và đối chiếu điều khoản.")
                        .build(),
                FeatureDto.builder().id(2L).icon("Wallet").title("Quản lý công nợ B2B")
                        .description("Theo dõi hạn thanh toán, đối soát công nợ và cảnh báo rủi ro dòng tiền theo đối tác.")
                        .build(),
                FeatureDto.builder().id(3L).icon("Store").title("Quản lý nhiều chi nhánh")
                        .description("Đồng bộ tồn kho, giá bán và hạn mức giao dịch giữa các chi nhánh và kho trung tâm.")
                        .build(),
                FeatureDto.builder().id(4L).icon("Truck").title("Theo dõi vận chuyển realtime")
                        .description("Cập nhật hành trình giao hàng, xác nhận giao nhận và xử lý sự cố kịp thời.")
                        .build()
        );
        log.info("Loaded {} home features", features.size());
        return features;
    }

    @Override
    public List<StepDto> getSteps() {
        log.info("Loading home steps");
        List<StepDto> steps = List.of(
                StepDto.builder().stepNumber("01").title("Tạo RFQ")
                        .description("Đăng nhu cầu thu mua theo lô, quy cách và khu vực giao nhận.")
                        .icon("FileText")
                        .build(),
                StepDto.builder().stepNumber("02").title("Nhận báo giá")
                        .description("So sánh báo giá theo giá, chất lượng và thời gian giao hàng.")
                        .icon("MessagesSquare")
                        .build(),
                StepDto.builder().stepNumber("03").title("Đặt hàng sỉ")
                        .description("Chốt đơn và thống nhất điều khoản với nhà cung cấp phù hợp.")
                        .icon("ShoppingCart")
                        .build(),
                StepDto.builder().stepNumber("04").title("Theo dõi vận chuyển")
                        .description("Theo dõi đơn hàng theo chặng và cập nhật trạng thái liên tục.")
                        .icon("MapPinned")
                        .build(),
                StepDto.builder().stepNumber("05").title("Quản lý thanh toán")
                        .description("Quản lý công nợ, đối soát giao dịch và hồ sơ thanh toán theo kỳ.")
                        .icon("ReceiptText")
                        .build()
        );
        log.info("Loaded {} home steps", steps.size());
        return steps;
    }

    @Override
    public List<TestimonialDto> getTestimonials() {
        log.info("Loading home testimonials");
        List<TestimonialDto> testimonials = List.of(
                TestimonialDto.builder()
                        .id(1L)
                        .name("Nguy\u1ec5n V\u0103n H\u1ea3i")
                        .role("Thu mua tr\u01b0\u1edfng")
                        .company("Chu\u1ed7i nh\u00e0 h\u00e0ng Bi\u1ec3n S\u00f3ng")
                        .avatar("/images/avatar-1.jpg")
                        .rating(5)
                        .comment("T\u00ecm ngu\u1ed3n t\u00f4m v\u00e0 c\u00e1 nhanh h\u01a1n, \u0111\u1ed1i chi\u1ebfu b\u00e1o gi\u00e1 theo l\u00f4 r\u00f5 r\u00e0ng v\u00e0 d\u1ec5 quy\u1ebft \u0111\u1ecbnh.")
                        .build(),
                TestimonialDto.builder()
                        .id(2L)
                        .name("Tr\u1ea7n Th\u1ecb Lan")
                        .role("Gi\u00e1m \u0111\u1ed1c v\u1eadn h\u00e0nh")
                        .company("Ch\u1ee3 \u0111\u1ea7u m\u1ed1i Mekong")
                        .avatar("/images/avatar-2.jpg")
                        .rating(5)
                        .comment("Theo d\u00f5i c\u00f4ng n\u1ee3 minh b\u1ea1ch, v\u1eadn chuy\u1ec3n hi\u1ec3n th\u1ecb realtime n\u00ean gi\u1ea3m tr\u1ec5 h\u1eb9n \u0111\u00e1ng k\u1ec3.")
                        .build(),
                TestimonialDto.builder()
                        .id(3L)
                        .name("L\u00ea Minh Tu\u1ea5n")
                        .role("\u0110\u1ea1i di\u1ec7n nh\u00e0 cung c\u1ea5p")
                        .company("N\u00f4ng tr\u1ea1i Th\u00e0nh Ph\u00fa")
                        .avatar("/images/avatar-3.jpg")
                        .rating(5)
                        .comment("RFQ gi\u00fap ti\u1ebfp c\u1eadn nhi\u1ec1u nh\u00e0 bu\u00f4n h\u01a1n, c\u00e1c \u0111\u01a1n mua theo l\u00f4 \u0111\u01b0\u1ee3c ch\u1ed1t nhanh v\u00e0 \u1ed5n \u0111\u1ecbnh.")
                        .build()
        );
        log.info("Loaded {} home testimonials", testimonials.size());
        return testimonials;
    }

    @Override
    public List<MarketPriceDto> getMarketPrices() {
        log.info("Loading market prices for home page");
        List<MarketPriceSnapshotEntity> snapshots = loadInternalMarketPriceSnapshots();
        if (!snapshots.isEmpty()) {
            Map<Long, String> imageByProductId = loadProductImages(snapshots);
            List<MarketPriceDto> marketPrices = latestByMarketGroup(snapshots).stream()
                    .sorted(Comparator.comparing(MarketPriceSnapshotEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(4)
                    .map(item -> toDto(item, previousFor(item, snapshots), imageByProductId.get(item.getProductId())))
                    .toList();
            log.info("Loaded {} realtime market prices", marketPrices.size());
            return marketPrices;
        }

        List<MarketPriceDto> marketPrices = marketPriceRepository.findAll().stream()
                .map(this::toDto)
                .toList();
        log.info("Loaded {} fallback market prices", marketPrices.size());
        return marketPrices;
    }

    @Override
    public CtaSummaryDto getCtaSummary() {
        log.info("Loading CTA summary");
        CtaBlockDto supplier = CtaBlockDto.builder()
                .title("M\u1edf r\u1ed9ng Th\u1ecb tr\u01b0\u1eddng Ngay h\u00f4m nay")
                .subtitle("K\u1ebft n\u1ed1i v\u1edbi th\u01b0\u01a1ng l\u00e1i, \u0111\u1ea1i l\u00fd v\u00e0 chu\u1ed7i c\u1eeda h\u00e0ng tr\u00ean to\u00e0n qu\u1ed1c \u0111\u1ec3 t\u0103ng doanh thu b\u1ec1n v\u1eefng.")
                .ctaText("\u0110\u0103ng k\u00fd Mi\u1ec5n ph\u00ed")
                .stats(List.of("2,500+ Nh\u00e0 cung c\u1ea5p", "50 t\u1ef7 Giao d\u1ecbch", "15K+ C\u01a1 h\u1ed9i b\u00e1n h\u00e0ng"))
                .build();

        CtaBlockDto buyer = CtaBlockDto.builder()
                .title("T\u00ecm ngu\u1ed3n h\u00e0ng Ch\u1ea5t l\u01b0\u1ee3ng Gi\u00e1 t\u1ed1t nh\u1ea5t")
                .subtitle("Thu mua \u0111a d\u1ea1ng ngu\u1ed3n cung theo l\u00f4, \u0111\u1ed1i chi\u1ebfu b\u00e1o gi\u00e1 nhanh v\u00e0 theo d\u00f5i giao h\u00e0ng 24/7.")
                .ctaText("B\u1eaft \u0111\u1ea7u Mua h\u00e0ng")
                .stats(List.of("8,000+ Nh\u00e0 bu\u00f4n", "100% Minh b\u1ea1ch theo l\u00f4", "24/7 H\u1ed7 tr\u1ee3"))
                .build();

        CtaSummaryDto summary = CtaSummaryDto.builder()
                .supplier(supplier)
                .buyer(buyer)
                .build();
        log.info("Loaded CTA summary");
        return summary;
    }

    private MarketPriceDto toDto(MarketPriceEntity entity) {
        return MarketPriceDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .image(entity.getImage())
                .price(entity.getPrice())
                .unit(entity.getUnit())
                .region(entity.getRegion())
                .trend(entity.getTrend())
                .build();
    }

    private List<MarketPriceSnapshotEntity> loadInternalMarketPriceSnapshots() {
        List<String> sourceTypes = List.of(
                MarketPriceAggregationServiceImpl.SOURCE_LISTING,
                MarketPriceAggregationServiceImpl.SOURCE_TRANSACTION);
        List<MarketPriceSnapshotEntity> snapshots = marketPriceSnapshotRepository.findBySourceTypeIn(sourceTypes);
        if (!snapshots.isEmpty()) {
            return snapshots;
        }
        marketPriceAggregationService.updateFromSupplierListings();
        return marketPriceSnapshotRepository.findBySourceTypeIn(sourceTypes);
    }

    private List<MarketPriceSnapshotEntity> latestByMarketGroup(List<MarketPriceSnapshotEntity> snapshots) {
        return snapshots.stream()
                .collect(java.util.stream.Collectors.toMap(
                        this::marketGroupKey,
                        Function.identity(),
                        (left, right) -> left.getPriceDate().isAfter(right.getPriceDate()) ? left : right,
                        LinkedHashMap::new))
                .values()
                .stream()
                .toList();
    }

    private MarketPriceSnapshotEntity previousFor(MarketPriceSnapshotEntity current, List<MarketPriceSnapshotEntity> snapshots) {
        return snapshots.stream()
                .filter(item -> marketGroupKey(item).equals(marketGroupKey(current)))
                .filter(item -> item.getPriceDate().isBefore(current.getPriceDate()))
                .max(Comparator.comparing(MarketPriceSnapshotEntity::getPriceDate))
                .orElse(null);
    }

    private String marketGroupKey(MarketPriceSnapshotEntity item) {
        return String.join("|",
                nullToEmpty(item.getNormalizedProductName()),
                nullToEmpty(item.getRegion()),
                nullToEmpty(item.getGrade()),
                nullToEmpty(item.getSize()),
                nullToEmpty(item.getUnit()),
                nullToEmpty(item.getSourceType()));
    }

    private Map<Long, String> loadProductImages(List<MarketPriceSnapshotEntity> snapshots) {
        List<Long> productIds = snapshots.stream()
                .map(MarketPriceSnapshotEntity::getProductId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return productImageRepository.findByProductIdIn(productIds).stream()
                .collect(java.util.stream.Collectors.toMap(
                        ProductImageEntity::getProductId,
                        ProductImageEntity::getImageUrl,
                        (left, right) -> left));
    }

    private MarketPriceDto toDto(MarketPriceSnapshotEntity item, MarketPriceSnapshotEntity previous, String imageUrl) {
        return MarketPriceDto.builder()
                .id(item.getId())
                .name(firstText(item.getProductTypeName(), item.getNormalizedProductName(), "San pham"))
                .image(firstText(imageUrl, fallbackImage(item.getNormalizedProductName()), "/images/seafood-market.jpg"))
                .price(formatCurrencyNumber(item.getAvgPrice()))
                .unit(firstText(item.getUnit(), "kg"))
                .region(firstText(item.getRegion(), "Khong xac dinh"))
                .trend(formatTrend(changePercent(item, previous)))
                .build();
    }

    private BigDecimal changePercent(MarketPriceSnapshotEntity current, MarketPriceSnapshotEntity previous) {
        if (current == null || previous == null || current.getAvgPrice() == null || previous.getAvgPrice() == null || previous.getAvgPrice().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return current.getAvgPrice().subtract(previous.getAvgPrice())
                .divide(previous.getAvgPrice().abs(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(1, RoundingMode.HALF_UP);
    }

    private String formatTrend(BigDecimal change) {
        if (change == null) {
            return "+0.0%";
        }
        return (change.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "") + change.toPlainString() + "%";
    }

    private String formatCurrencyNumber(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        DecimalFormat formatter = new DecimalFormat("#,###", DecimalFormatSymbols.getInstance(Locale.US));
        formatter.setRoundingMode(RoundingMode.HALF_UP);
        return formatter.format(value.setScale(0, RoundingMode.HALF_UP));
    }

    private String fallbackImage(String normalizedProductName) {
        String value = normalizedProductName == null ? "" : normalizedProductName.toLowerCase(Locale.ROOT);
        if (value.contains("tom") || value.contains("shrimp")) return "/images/shrimp.jpg";
        if (value.contains("ca") || value.contains("fish")) return "/images/fish-fillet.jpg";
        if (value.contains("gao") || value.contains("rice")) return "/images/rice.jpg";
        if (value.contains("thanh long") || value.contains("dragon")) return "/images/dragon-fruit.jpg";
        return "/images/seafood-market.jpg";
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
