package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminDisputeDto;
import com.agribridge.backend.entity.ComplaintEntity;
import com.agribridge.backend.entity.enums.ComplaintStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.AdminDisputeService;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
public class AdminDisputeServiceImpl implements AdminDisputeService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String DISPUTE_SELECT = """
            SELECT
                c.id AS dispute_id,
                c.order_id,
                c.batch_id,
                c.created_by_user_id,
                c.assigned_to_user_id,
                CAST(c.status AS NVARCHAR(255)) AS dispute_status,
                CAST(c.severity AS NVARCHAR(255)) AS dispute_severity,
                CAST(c.title AS NVARCHAR(255)) AS dispute_title,
                CAST(c.description AS NVARCHAR(MAX)) AS dispute_description,
                CAST(c.resolution AS NVARCHAR(MAX)) AS dispute_resolution,
                c.created_at,
                c.resolved_at,
                CAST(buyer.name AS NVARCHAR(255)) AS buyer_name,
                CAST(supplier.name AS NVARCHAR(255)) AS supplier_name,
                CAST(product.name AS NVARCHAR(255)) AS product_name,
                o.total_amount,
                CAST(created_user.full_name AS NVARCHAR(255)) AS created_by_name,
                CAST(assigned_user.full_name AS NVARCHAR(255)) AS assigned_to_name
            FROM complaints c
            LEFT JOIN orders o ON o.id = c.order_id
            LEFT JOIN companies buyer ON buyer.id = o.buyer_company_id
            LEFT JOIN companies supplier ON supplier.id = o.supplier_company_id
            LEFT JOIN batches batch ON batch.id = c.batch_id
            LEFT JOIN products product ON product.id = batch.product_id
            LEFT JOIN users created_user ON created_user.id = c.created_by_user_id
            LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to_user_id
            WHERE 1 = 1
            """;

    private final ComplaintRepository complaintRepository;
    private final OrderRepository orderRepository;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<AdminDisputeDto> getDisputes(String search, String status) {
        log.info("Fetching disputes search={} status={}", search, status);
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder(DISPUTE_SELECT);

        ComplaintStatusEnum normalizedStatus = parseStatus(status);
        if (normalizedStatus != null) {
            sql.append(" AND c.status = ? ");
            params.add(normalizedStatus.name());
        }

        String normalizedSearch = normalizeSearch(search);
        if (normalizedSearch != null) {
            sql.append("""
                     AND (
                        LOWER(CAST(COALESCE(c.title, '') AS NVARCHAR(255))) LIKE ?
                        OR LOWER(CAST(COALESCE(c.description, '') AS NVARCHAR(MAX))) LIKE ?
                        OR LOWER(CAST(COALESCE(buyer.name, '') AS NVARCHAR(255))) LIKE ?
                        OR LOWER(CAST(COALESCE(supplier.name, '') AS NVARCHAR(255))) LIKE ?
                        OR LOWER(CAST(COALESCE(product.name, '') AS NVARCHAR(255))) LIKE ?
                        OR CAST(c.order_id AS NVARCHAR(50)) LIKE ?
                     )
                    """);
            String keyword = "%" + normalizedSearch + "%";
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
        }

        sql.append(" ORDER BY c.created_at DESC, c.id DESC");
        List<AdminDisputeDto> disputes = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapRow(new AdminDisputeRowSnapshot(
                rs.getLong("dispute_id"),
                rs.getLong("order_id"),
                rs.getObject("batch_id") == null ? null : rs.getLong("batch_id"),
                rs.getLong("created_by_user_id"),
                rs.getObject("assigned_to_user_id") == null ? null : rs.getLong("assigned_to_user_id"),
                rs.getString("dispute_status"),
                rs.getString("dispute_severity"),
                rs.getString("dispute_title"),
                rs.getString("dispute_description"),
                rs.getString("dispute_resolution"),
                toLocalDateTime(rs.getTimestamp("created_at")),
                toLocalDateTime(rs.getTimestamp("resolved_at")),
                rs.getString("buyer_name"),
                rs.getString("supplier_name"),
                rs.getString("product_name"),
                rs.getBigDecimal("total_amount"),
                rs.getString("created_by_name"),
                rs.getString("assigned_to_name"))), params.toArray());
        log.info("Fetched {} disputes", disputes.size());
        return disputes;
    }

    @Override
    @Transactional(readOnly = true)
    public AdminDisputeDto getDisputeById(Long disputeId) {
        log.info("Fetching dispute by id={}", disputeId);
        List<AdminDisputeDto> disputes = jdbcTemplate.query(
                DISPUTE_SELECT + " AND c.id = ?",
                (rs, rowNum) -> mapRow(new AdminDisputeRowSnapshot(
                        rs.getLong("dispute_id"),
                        rs.getLong("order_id"),
                        rs.getObject("batch_id") == null ? null : rs.getLong("batch_id"),
                        rs.getLong("created_by_user_id"),
                        rs.getObject("assigned_to_user_id") == null ? null : rs.getLong("assigned_to_user_id"),
                        rs.getString("dispute_status"),
                        rs.getString("dispute_severity"),
                        rs.getString("dispute_title"),
                        rs.getString("dispute_description"),
                        rs.getString("dispute_resolution"),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        toLocalDateTime(rs.getTimestamp("resolved_at")),
                        rs.getString("buyer_name"),
                        rs.getString("supplier_name"),
                        rs.getString("product_name"),
                        rs.getBigDecimal("total_amount"),
                        rs.getString("created_by_name"),
                        rs.getString("assigned_to_name"))),
                disputeId);

        if (disputes.isEmpty()) {
            log.warn("Dispute not found id={}", disputeId);
            throw new IllegalArgumentException("Dispute not found: " + disputeId);
        }
        log.info("Fetched dispute id={}", disputeId);
        return disputes.get(0);
    }

    @Override
    @Transactional
    public AdminDisputeDto createDispute(
            Long orderId,
            Long batchId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution) {
        log.info("Creating dispute orderId={} batchId={} createdByUserId={} assignedToUserId={} status={}",
                orderId, batchId, createdByUserId, assignedToUserId, status);
        validateOrder(orderId);
        validateBatch(batchId);
        validateUser(createdByUserId, "Người tạo");
        validateUser(assignedToUserId, "Người xử lý");

        ComplaintEntity complaint = complaintRepository.save(ComplaintEntity.builder()
                .orderId(orderId)
                .batchId(batchId)
                .createdByUserId(createdByUserId)
                .assignedToUserId(assignedToUserId)
                .status(parseStatusOrDefault(status))
                .severity(normalizeSeverity(severity))
                .title(normalizeRequired(title, "Tiêu đề tranh chấp là bắt buộc."))
                .description(normalizeRequired(description, "Mô tả tranh chấp là bắt buộc."))
                .resolution(normalizeText(resolution))
                .resolvedAt(resolveResolvedAt(parseStatusOrDefault(status)))
                .createdAt(LocalDateTime.now())
                .build());

        AdminDisputeDto dispute = getDisputeById(complaint.getId());
        log.info("Created dispute id={}", dispute.getId());
        return dispute;
    }

    @Override
    @Transactional
    public AdminDisputeDto updateDispute(
            Long disputeId,
            Long orderId,
            Long batchId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution) {
        log.info("Updating dispute id={} orderId={} batchId={} status={}", disputeId, orderId, batchId, status);
        ComplaintEntity complaint = complaintRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));

        validateOrder(orderId);
        validateBatch(batchId);
        validateUser(createdByUserId, "Người tạo");
        validateUser(assignedToUserId, "Người xử lý");

        ComplaintStatusEnum nextStatus = parseStatusOrDefault(status);
        complaint.setOrderId(orderId);
        complaint.setBatchId(batchId);
        complaint.setCreatedByUserId(createdByUserId);
        complaint.setAssignedToUserId(assignedToUserId);
        complaint.setStatus(nextStatus);
        complaint.setSeverity(normalizeSeverity(severity));
        complaint.setTitle(normalizeRequired(title, "Tiêu đề tranh chấp là bắt buộc."));
        complaint.setDescription(normalizeRequired(description, "Mô tả tranh chấp là bắt buộc."));
        complaint.setResolution(normalizeText(resolution));
        complaint.setResolvedAt(resolveResolvedAt(nextStatus));

        complaintRepository.save(complaint);
        AdminDisputeDto dispute = getDisputeById(disputeId);
        log.info("Updated dispute id={} newStatus={}", disputeId, dispute.getStatus());
        return dispute;
    }

    @Override
    @Transactional
    public AdminDisputeDto updateDisputeStatus(Long disputeId, Long assignedToUserId, String status, String resolution) {
        log.info("Updating dispute status disputeId={} assignedToUserId={} status={}", disputeId, assignedToUserId, status);
        ComplaintEntity complaint = complaintRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));

        ComplaintStatusEnum nextStatus = parseStatus(status);
        if (nextStatus == null) {
            throw new IllegalArgumentException("Trạng thái tranh chấp không hợp lệ.");
        }

        validateUser(assignedToUserId, "Người xử lý");
        complaint.setAssignedToUserId(assignedToUserId);
        complaint.setStatus(nextStatus);
        complaint.setResolution(normalizeText(resolution));
        complaint.setResolvedAt(resolveResolvedAt(nextStatus));

        complaintRepository.save(complaint);
        AdminDisputeDto dispute = getDisputeById(disputeId);
        log.info("Updated dispute status disputeId={} newStatus={}", disputeId, dispute.getStatus());
        return dispute;
    }

    @Override
    @Transactional
    public void deleteDispute(Long disputeId) {
        log.info("Deleting dispute id={}", disputeId);
        if (!complaintRepository.existsById(disputeId)) {
            log.warn("Cannot delete dispute because id={} was not found", disputeId);
            throw new IllegalArgumentException("Dispute not found: " + disputeId);
        }
        complaintRepository.deleteById(disputeId);
        log.info("Deleted dispute id={}", disputeId);
    }

    private AdminDisputeDto mapRow(AdminDisputeRowSnapshot row) {
        ComplaintStatusEnum status = parseStatus(row.status());
        String severity = normalizeSeverity(row.severity());
        return AdminDisputeDto.builder()
                .id(row.id())
                .orderId(row.orderId())
                .batchId(row.batchId())
                .createdByUserId(row.createdByUserId())
                .assignedToUserId(row.assignedToUserId())
                .disputeCode("DSP-" + row.id())
                .status(status == null ? ComplaintStatusEnum.OPEN.name() : status.name())
                .statusLabel(toStatusLabel(status))
                .severity(severity)
                .severityLabel(toSeverityLabel(severity))
                .title(firstNonBlank(row.title(), summarizeTitle(row.description()), "Tranh chấp đơn hàng #" + row.orderId()))
                .description(firstNonBlank(row.description(), "Chưa có mô tả"))
                .resolution(row.resolution())
                .buyerName(firstNonBlank(row.buyerName(), "Chưa xác định"))
                .supplierName(firstNonBlank(row.supplierName(), "Chưa xác định"))
                .product(firstNonBlank(row.product(), "Chưa xác định"))
                .amount(formatMoney(row.totalAmount()))
                .createdByName(firstNonBlank(row.createdByName(), "Chưa xác định"))
                .assignedToName(firstNonBlank(row.assignedToName(), "Chưa phân công"))
                .createdAt(row.createdAt() == null ? null : row.createdAt().format(DATE_FORMATTER))
                .resolvedAt(row.resolvedAt() == null ? null : row.resolvedAt().format(DATE_FORMATTER))
                .build();
    }

    private void validateOrder(Long orderId) {
        if (orderId == null || !orderRepository.existsById(orderId)) {
            throw new IllegalArgumentException("Đơn hàng không tồn tại.");
        }
    }

    private void validateBatch(Long batchId) {
        if (batchId == null) {
            return;
        }
        if (!batchRepository.existsById(batchId)) {
            throw new IllegalArgumentException("Lô hàng không tồn tại.");
        }
    }

    private void validateUser(Long userId, String label) {
        if (userId == null) {
            return;
        }
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException(label + " không tồn tại.");
        }
    }

    private ComplaintStatusEnum parseStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return null;
        }
        try {
            return ComplaintStatusEnum.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private ComplaintStatusEnum parseStatusOrDefault(String rawStatus) {
        ComplaintStatusEnum status = parseStatus(rawStatus);
        return status == null ? ComplaintStatusEnum.OPEN : status;
    }

    private String normalizeSeverity(String rawSeverity) {
        if (rawSeverity == null || rawSeverity.isBlank()) {
            return "MEDIUM";
        }
        String normalized = rawSeverity.trim().toUpperCase(Locale.ROOT);
        return "HIGH".equals(normalized) ? "HIGH" : "MEDIUM";
    }

    private String toStatusLabel(ComplaintStatusEnum status) {
        if (status == ComplaintStatusEnum.INVESTIGATING) {
            return "Đang điều tra";
        }
        if (status == ComplaintStatusEnum.RESOLVED) {
            return "Đã giải quyết";
        }
        if (status == ComplaintStatusEnum.REJECTED) {
            return "Đã từ chối";
        }
        return "Chờ xử lý";
    }

    private String toSeverityLabel(String severity) {
        return "HIGH".equalsIgnoreCase(severity) ? "Cao" : "Trung bình";
    }

    private String summarizeTitle(String description) {
        String normalized = normalizeText(description);
        if (normalized == null) {
            return null;
        }
        return normalized.length() <= 80 ? normalized : normalized.substring(0, 80).trim() + "...";
    }

    private String normalizeSearch(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        return search.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private LocalDateTime resolveResolvedAt(ComplaintStatusEnum status) {
        return status == ComplaintStatusEnum.RESOLVED ? LocalDateTime.now() : null;
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private String formatMoney(BigDecimal amount) {
        if (amount == null) {
            return "Chưa có";
        }
        return amount.stripTrailingZeros().toPlainString() + " đ";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private record AdminDisputeRowSnapshot(
            Long id,
            Long orderId,
            Long batchId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt,
            String buyerName,
            String supplierName,
            String product,
            BigDecimal totalAmount,
            String createdByName,
            String assignedToName) {
    }
}
