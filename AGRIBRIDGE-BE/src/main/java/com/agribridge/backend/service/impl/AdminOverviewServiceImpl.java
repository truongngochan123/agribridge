package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminOverviewActivityRequestDto;
import com.agribridge.backend.dto.AdminOverviewResponseDto;
import com.agribridge.backend.dto.AdminQuickStatRequestDto;
import com.agribridge.backend.entity.AdminOverviewActivityEntity;
import com.agribridge.backend.entity.AdminQuickStatEntity;
import com.agribridge.backend.entity.enums.ComplaintStatusEnum;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.repository.AdminOverviewActivityRepository;
import com.agribridge.backend.repository.AdminQuickStatRepository;
import com.agribridge.backend.service.AdminOverviewService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminOverviewServiceImpl implements AdminOverviewService {

    private static final DateTimeFormatter MONTH_DAY_FORMATTER = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("MM/yyyy");

    private final JdbcTemplate jdbcTemplate;
    private final AdminOverviewActivityRepository activityRepository;
    private final AdminQuickStatRepository quickStatRepository;

    @Override
    @Transactional(readOnly = true)
    public AdminOverviewResponseDto getOverview(String filter) {
        log.info("Loading admin overview filter={}", filter);
        DateRange current = resolveDateRange(filter);
        DateRange previous = new DateRange(current.start().minusDays(current.days()), current.start().minusDays(1), current.days());

        BigDecimal currentGmv = queryBigDecimal(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(current.start().atStartOfDay()),
                Timestamp.valueOf(current.endExclusive().atStartOfDay()));
        BigDecimal previousGmv = queryBigDecimal(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(previous.start().atStartOfDay()),
                Timestamp.valueOf(previous.endExclusive().atStartOfDay()));

        long currentOrders = queryLong(
                "SELECT COUNT(1) FROM orders WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(current.start().atStartOfDay()),
                Timestamp.valueOf(current.endExclusive().atStartOfDay()));
        long previousOrders = queryLong(
                "SELECT COUNT(1) FROM orders WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(previous.start().atStartOfDay()),
                Timestamp.valueOf(previous.endExclusive().atStartOfDay()));

        long currentNewUsers = queryLong(
                "SELECT COUNT(1) FROM users WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(current.start().atStartOfDay()),
                Timestamp.valueOf(current.endExclusive().atStartOfDay()));
        long previousNewUsers = queryLong(
                "SELECT COUNT(1) FROM users WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(previous.start().atStartOfDay()),
                Timestamp.valueOf(previous.endExclusive().atStartOfDay()));

        long currentDisputes = queryLong(
                "SELECT COUNT(1) FROM complaints WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(current.start().atStartOfDay()),
                Timestamp.valueOf(current.endExclusive().atStartOfDay()));
        long previousDisputes = queryLong(
                "SELECT COUNT(1) FROM complaints WHERE created_at >= ? AND created_at < ?",
                Timestamp.valueOf(previous.start().atStartOfDay()),
                Timestamp.valueOf(previous.endExclusive().atStartOfDay()));

        double currentDisputeRate = currentOrders == 0 ? 0.0 : (double) currentDisputes / currentOrders * 100.0;
        double previousDisputeRate = previousOrders == 0 ? 0.0 : (double) previousDisputes / previousOrders * 100.0;

        BigDecimal outstandingDebt = queryBigDecimal(
                "SELECT COALESCE(SUM(adjusted_amount), 0) FROM invoices WHERE status IN (?, ?)",
                InvoiceStatusEnum.UNPAID.name(),
                InvoiceStatusEnum.OVERDUE.name());
        long overdueInvoices = queryLong("SELECT COUNT(1) FROM invoices WHERE status = ?", InvoiceStatusEnum.OVERDUE.name());
        long openDisputes = queryLong(
                "SELECT COUNT(1) FROM complaints WHERE status IN (?, ?)",
                ComplaintStatusEnum.OPEN.name(),
                ComplaintStatusEnum.INVESTIGATING.name());

        AdminOverviewResponseDto response = AdminOverviewResponseDto.builder()
                .kpis(List.of(
                        buildStat("Tổng GMV", formatCompactCurrency(currentGmv), buildChangeText(currentGmv, previousGmv, current.days()), tone(currentGmv, previousGmv), "emerald"),
                        buildStat("Tổng đơn hàng", formatWholeNumber(currentOrders), buildChangeText(currentOrders, previousOrders, current.days()), tone(currentOrders, previousOrders), "blue"),
                        buildStat("Người dùng mới", formatWholeNumber(currentNewUsers), buildChangeText(currentNewUsers, previousNewUsers, current.days()), tone(currentNewUsers, previousNewUsers), "violet"),
                        buildStat("Tỷ lệ tranh chấp", formatPercent(currentDisputeRate), buildChangeText(currentDisputeRate, previousDisputeRate, current.days()), tone(currentDisputeRate, previousDisputeRate), "amber")))
                .gmvSeries(buildGmvSeries(current))
                .risks(List.of(
                        AdminOverviewResponseDto.AdminRiskMetricDto.builder().key("outstandingDebt").label("Tổng công nợ chưa thanh toán").value(formatCompactCurrency(outstandingDebt)).hint("Tổng giá trị invoice chưa xử lý xong").critical(outstandingDebt.compareTo(BigDecimal.ZERO) > 0).build(),
                        AdminOverviewResponseDto.AdminRiskMetricDto.builder().key("overdueInvoices").label("So invoice qua han").value(formatWholeNumber(overdueInvoices)).hint("Can uu tien nhom invoice OVERDUE").critical(overdueInvoices > 0).build(),
                        AdminOverviewResponseDto.AdminRiskMetricDto.builder().key("openDisputes").label("So tranh chap dang mo").value(formatWholeNumber(openDisputes)).hint("Bao gom OPEN va INVESTIGATING").critical(openDisputes > 0).build()))
                .activities(activityRepository.findAllByOrderBySortOrderAscIdAsc().stream().map(this::mapActivity).toList())
                .quickStats(resolveQuickStats())
                .build();
        log.info("Loaded admin overview filter={} openDisputes={} overdueInvoices={}", filter, openDisputes, overdueInvoices);
        return response;
    }

    @Override
    @Transactional
    public AdminOverviewResponseDto.AdminActivityDto createActivity(AdminOverviewActivityRequestDto request) {
        log.info("Creating admin activity title={}", request == null ? null : request.getTitle());
        AdminOverviewActivityEntity saved = activityRepository.save(AdminOverviewActivityEntity.builder()
                .title(requireText(request.getTitle(), "Activity title is required"))
                .description(requireText(request.getDescription(), "Activity description is required"))
                .timeLabel(requireText(request.getTime(), "Activity time is required"))
                .color(normalizeActivityColor(request.getColor()))
                .sortOrder(activityRepository.findAllByOrderBySortOrderAscIdAsc().size() + 1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build());
        AdminOverviewResponseDto.AdminActivityDto activity = mapActivity(saved);
        log.info("Created admin activity id={}", activity.getId());
        return activity;
    }

    @Override
    @Transactional
    public AdminOverviewResponseDto.AdminActivityDto updateActivity(Long activityId, AdminOverviewActivityRequestDto request) {
        log.info("Updating admin activity id={}", activityId);
        AdminOverviewActivityEntity entity = activityRepository.findById(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found: " + activityId));
        entity.setTitle(requireText(request.getTitle(), "Activity title is required"));
        entity.setDescription(requireText(request.getDescription(), "Activity description is required"));
        entity.setTimeLabel(requireText(request.getTime(), "Activity time is required"));
        entity.setColor(normalizeActivityColor(request.getColor()));
        entity.setUpdatedAt(LocalDateTime.now());
        AdminOverviewResponseDto.AdminActivityDto activity = mapActivity(activityRepository.save(entity));
        log.info("Updated admin activity id={}", activityId);
        return activity;
    }

    @Override
    @Transactional
    public void deleteActivity(Long activityId) {
        log.info("Deleting admin activity id={}", activityId);
        if (!activityRepository.existsById(activityId)) {
            log.warn("Cannot delete admin activity because id={} was not found", activityId);
            throw new IllegalArgumentException("Activity not found: " + activityId);
        }
        activityRepository.deleteById(activityId);
        log.info("Deleted admin activity id={}", activityId);
    }

    @Override
    @Transactional
    public AdminOverviewResponseDto.AdminQuickStatDto createQuickStat(AdminQuickStatRequestDto request) {
        log.info("Creating admin quick stat label={}", request == null ? null : request.getLabel());
        AdminQuickStatEntity saved = quickStatRepository.save(AdminQuickStatEntity.builder()
                .label(requireText(request.getLabel(), "Quick stat label is required"))
                .subLabel(requireText(request.getSubLabel(), "Quick stat sub label is required"))
                .value(requireText(request.getValue(), "Quick stat value is required"))
                .color(normalizeQuickStatColor(request.getColor()))
                .sortOrder(quickStatRepository.findAllByOrderBySortOrderAscIdAsc().size() + 1)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build());
        AdminOverviewResponseDto.AdminQuickStatDto stat = mapQuickStat(saved);
        log.info("Created admin quick stat id={}", stat.getId());
        return stat;
    }

    @Override
    @Transactional
    public AdminOverviewResponseDto.AdminQuickStatDto updateQuickStat(Long statId, AdminQuickStatRequestDto request) {
        log.info("Updating admin quick stat id={}", statId);
        AdminQuickStatEntity entity = quickStatRepository.findById(statId)
                .orElseThrow(() -> new IllegalArgumentException("Quick stat not found: " + statId));
        entity.setLabel(requireText(request.getLabel(), "Quick stat label is required"));
        entity.setSubLabel(requireText(request.getSubLabel(), "Quick stat sub label is required"));
        entity.setValue(requireText(request.getValue(), "Quick stat value is required"));
        entity.setColor(normalizeQuickStatColor(request.getColor()));
        entity.setUpdatedAt(LocalDateTime.now());
        AdminOverviewResponseDto.AdminQuickStatDto stat = mapQuickStat(quickStatRepository.save(entity));
        log.info("Updated admin quick stat id={}", statId);
        return stat;
    }

    @Override
    @Transactional
    public void deleteQuickStat(Long statId) {
        log.info("Deleting admin quick stat id={}", statId);
        if (!quickStatRepository.existsById(statId)) {
            log.warn("Cannot delete admin quick stat because id={} was not found", statId);
            throw new IllegalArgumentException("Quick stat not found: " + statId);
        }
        quickStatRepository.deleteById(statId);
        log.info("Deleted admin quick stat id={}", statId);
    }

    private List<AdminOverviewResponseDto.AdminGmvPointDto> buildGmvSeries(DateRange range) {
        List<AdminOverviewResponseDto.AdminGmvPointDto> points = new ArrayList<>();
        if (range.days() <= 10) {
            for (int offset = 0; offset < range.days(); offset++) {
                LocalDate date = range.start().plusDays(offset);
                BigDecimal total = queryBigDecimal(
                        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= ? AND created_at < ?",
                        Timestamp.valueOf(date.atStartOfDay()),
                        Timestamp.valueOf(date.plusDays(1).atStartOfDay()));
                points.add(AdminOverviewResponseDto.AdminGmvPointDto.builder().label(date.format(MONTH_DAY_FORMATTER)).value(total.doubleValue()).build());
            }
            return points;
        }

        if (range.days() > 90) {
            LocalDate monthCursor = range.start().withDayOfMonth(1);
            while (!monthCursor.isAfter(range.endInclusive())) {
                LocalDate nextMonth = monthCursor.plusMonths(1);
                BigDecimal total = queryBigDecimal(
                        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= ? AND created_at < ?",
                        Timestamp.valueOf(monthCursor.atStartOfDay()),
                        Timestamp.valueOf(nextMonth.atStartOfDay()));
                points.add(AdminOverviewResponseDto.AdminGmvPointDto.builder().label(monthCursor.format(MONTH_FORMATTER)).value(total.doubleValue()).build());
                monthCursor = nextMonth;
            }
            return points;
        }

        LocalDate cursor = range.start();
        while (!cursor.isAfter(range.endInclusive())) {
            LocalDate bucketEnd = cursor.plusDays(Math.min(6, ChronoUnit.DAYS.between(cursor, range.endInclusive())));
            BigDecimal total = queryBigDecimal(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= ? AND created_at < ?",
                    Timestamp.valueOf(cursor.atStartOfDay()),
                    Timestamp.valueOf(bucketEnd.plusDays(1).atStartOfDay()));
            points.add(AdminOverviewResponseDto.AdminGmvPointDto.builder().label(cursor.format(MONTH_DAY_FORMATTER)).value(total.doubleValue()).build());
            cursor = bucketEnd.plusDays(1);
        }
        return points;
    }

    private List<AdminOverviewResponseDto.AdminQuickStatDto> resolveQuickStats() {
        List<AdminQuickStatEntity> customStats = quickStatRepository.findAllByOrderBySortOrderAscIdAsc();
        if (!customStats.isEmpty()) {
            return customStats.stream().map(this::mapQuickStat).toList();
        }

        long suppliers = queryLong("SELECT COUNT(1) FROM companies WHERE company_type = ? AND verification_status = ?", "SUPPLIER", "APPROVED");
        long buyers = queryLong("SELECT COUNT(1) FROM companies WHERE company_type = ? AND verification_status = ?", "BUYER", "APPROVED");
        long lots = queryLong("SELECT COUNT(1) FROM batches");
        long pending = queryLong("SELECT COUNT(1) FROM complaints WHERE status IN (?, ?)", "OPEN", "INVESTIGATING");

        return List.of(
                AdminOverviewResponseDto.AdminQuickStatDto.builder().id(null).label("Nhà cung cấp").subLabel("Đã được duyệt").value(formatWholeNumber(suppliers)).color("emerald").build(),
                AdminOverviewResponseDto.AdminQuickStatDto.builder().id(null).label("Nhà buôn").subLabel("Đã được duyệt").value(formatWholeNumber(buyers)).color("blue").build(),
                AdminOverviewResponseDto.AdminQuickStatDto.builder().id(null).label("Lô hàng").subLabel("Trong hệ thống").value(formatWholeNumber(lots)).color("violet").build(),
                AdminOverviewResponseDto.AdminQuickStatDto.builder().id(null).label("Chờ xử lý").subLabel("Tranh chấp đang mở").value(formatWholeNumber(pending)).color("amber").build());
    }

    private AdminOverviewResponseDto.AdminActivityDto mapActivity(AdminOverviewActivityEntity entity) {
        return AdminOverviewResponseDto.AdminActivityDto.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .time(entity.getTimeLabel())
                .color(normalizeActivityColor(entity.getColor()))
                .build();
    }

    private AdminOverviewResponseDto.AdminQuickStatDto mapQuickStat(AdminQuickStatEntity entity) {
        return AdminOverviewResponseDto.AdminQuickStatDto.builder()
                .id(entity.getId())
                .label(entity.getLabel())
                .subLabel(entity.getSubLabel())
                .value(entity.getValue())
                .color(normalizeQuickStatColor(entity.getColor()))
                .build();
    }

    private AdminOverviewResponseDto.AdminStatDto buildStat(String title, String value, String change, String tone, String color) {
        return AdminOverviewResponseDto.AdminStatDto.builder().title(title).value(value).change(change).changeTone(tone).color(color).build();
    }

    private DateRange resolveDateRange(String filter) {
        LocalDate today = LocalDate.now();
        String normalized = filter == null ? "30d" : filter.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "7d" -> new DateRange(today.minusDays(6), today, 7);
            case "3m" -> new DateRange(today.minusMonths(3).plusDays(1), today, 90);
            case "12m" -> new DateRange(today.minusMonths(12).plusDays(1), today, 365);
            default -> new DateRange(today.minusDays(29), today, 30);
        };
    }

    private BigDecimal queryBigDecimal(String sql, Object... params) {
        BigDecimal value = jdbcTemplate.queryForObject(sql, BigDecimal.class, params);
        return value == null ? BigDecimal.ZERO : value;
    }

    private long queryLong(String sql, Object... params) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, params);
        return value == null ? 0L : value;
    }

    private String buildChangeText(BigDecimal current, BigDecimal previous, long days) {
        double ratio = previous.compareTo(BigDecimal.ZERO) == 0
                ? 100.0
                : current.subtract(previous)
                        .divide(previous.abs().compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ONE : previous.abs(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue();
        return formatSignedPercent(ratio) + " vs " + days + " ngày trước";
    }

    private String buildChangeText(long current, long previous, long days) {
        double ratio = previous == 0 ? 100.0 : ((double) (current - previous) / Math.abs(previous)) * 100.0;
        return formatSignedPercent(ratio) + " vs " + days + " ngày trước";
    }

    private String buildChangeText(double current, double previous, long days) {
        return formatSignedPercent(current - previous) + " điểm vs " + days + " ngày trước";
    }

    private String tone(BigDecimal current, BigDecimal previous) {
        return current.compareTo(previous) >= 0 ? "up" : "down";
    }

    private String tone(long current, long previous) {
        return current >= previous ? "up" : "down";
    }

    private String tone(double current, double previous) {
        return current <= previous ? "up" : "down";
    }

    private String formatCompactCurrency(BigDecimal amount) {
        BigDecimal absolute = amount.abs();
        if (absolute.compareTo(BigDecimal.valueOf(1_000_000_000L)) >= 0) {
            return amount.divide(BigDecimal.valueOf(1_000_000_000L), 1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString() + " tỷ";
        }
        if (absolute.compareTo(BigDecimal.valueOf(1_000_000L)) >= 0) {
            return amount.divide(BigDecimal.valueOf(1_000_000L), 1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString() + " triệu";
        }
        return amount.stripTrailingZeros().toPlainString() + " đ";
    }

    private String formatWholeNumber(long value) {
        return String.valueOf(value);
    }

    private String formatPercent(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString() + "%";
    }

    private String formatSignedPercent(double value) {
        BigDecimal rounded = BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP);
        String sign = rounded.compareTo(BigDecimal.ZERO) > 0 ? "+" : "";
        return sign + rounded.stripTrailingZeros().toPlainString() + "%";
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String normalizeActivityColor(String color) {
        if (color == null) return "emerald";
        String normalized = color.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "blue", "red", "violet" -> normalized;
            default -> "emerald";
        };
    }

    private String normalizeQuickStatColor(String color) {
        if (color == null) return "emerald";
        String normalized = color.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "blue", "violet", "amber" -> normalized;
            default -> "emerald";
        };
    }

    private record DateRange(LocalDate start, LocalDate endInclusive, long days) {
        LocalDate endExclusive() {
            return endInclusive.plusDays(1);
        }
    }
}
