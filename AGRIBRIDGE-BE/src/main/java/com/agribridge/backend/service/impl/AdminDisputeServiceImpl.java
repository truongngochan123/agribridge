package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.AdminDisputeDto;
import com.agribridge.backend.entity.ComplaintEntity;
import com.agribridge.backend.entity.EscrowTransactionEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.WalletAccountEntity;
import com.agribridge.backend.entity.WalletLedgerEntryEntity;
import com.agribridge.backend.entity.enums.ComplaintStatusEnum;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.EscrowTransactionRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentIncidentRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.repository.WalletAccountRepository;
import com.agribridge.backend.repository.WalletLedgerEntryRepository;
import com.agribridge.backend.service.AdminDisputeService;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.NotificationCenterService;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final String SOURCE_ORDER_COMPLAINT = "ORDER_COMPLAINT";
    private static final String SOURCE_SHIPMENT_INCIDENT = "SHIPMENT_INCIDENT";
    private static final String SOURCE_ADMIN_MANUAL = "ADMIN_MANUAL";
    private static final List<String> PAID_PAYMENT_STATUSES = List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS");
    private static final String DECISION_REJECT_CLAIM = "REJECT_CLAIM";
    private static final String DECISION_RELEASE_TO_SUPPLIER = "RELEASE_TO_SUPPLIER";
    private static final String DECISION_FULL_REFUND = "FULL_REFUND";
    private static final String DECISION_PARTIAL_REFUND = "PARTIAL_REFUND";
    private static final String DECISION_COMPENSATION = "COMPENSATION";
    private static final String DECISION_REPLACEMENT = "REPLACEMENT";
    private static final String DISPUTE_SELECT = """
            SELECT
                c.id AS dispute_id,
                c.order_id,
                c.batch_id,
                c.shipment_id,
                CAST(c.source_type AS NVARCHAR(50)) AS source_type,
                c.source_id,
                c.created_by_user_id,
                c.assigned_to_user_id,
                CAST(c.status AS NVARCHAR(255)) AS dispute_status,
                CAST(c.severity AS NVARCHAR(255)) AS dispute_severity,
                CAST(c.title AS NVARCHAR(255)) AS dispute_title,
                CAST(c.description AS NVARCHAR(MAX)) AS dispute_description,
                CAST(c.resolution AS NVARCHAR(MAX)) AS dispute_resolution,
                CAST(c.decision_type AS NVARCHAR(80)) AS decision_type,
                c.refund_amount,
                c.compensation_amount,
                c.resolved_by_user_id,
                c.created_at,
                c.resolved_at,
                CAST(buyer.name AS NVARCHAR(255)) AS buyer_name,
                CAST(supplier.name AS NVARCHAR(255)) AS supplier_name,
                CAST(product.name AS NVARCHAR(255)) AS product_name,
                o.total_amount,
                o.shipping_fee,
                first_item.quantity AS order_item_quantity,
                first_item.price AS order_item_price,
                CAST(first_item.unit AS NVARCHAR(50)) AS order_item_unit,
                CAST(first_item_product.name AS NVARCHAR(255)) AS order_item_product_name,
                CAST(created_user.full_name AS NVARCHAR(255)) AS created_by_name,
                CAST(assigned_user.full_name AS NVARCHAR(255)) AS assigned_to_name,
                CAST(incident.incident_type AS NVARCHAR(100)) AS incident_type,
                CAST(incident.status AS NVARCHAR(80)) AS incident_status,
                CAST(incident.evidence_urls AS NVARCHAR(MAX)) AS buyer_evidence_urls,
                CAST(incident.supplier_response AS NVARCHAR(MAX)) AS supplier_response,
                CAST(incident.supplier_evidence_urls AS NVARCHAR(MAX)) AS supplier_evidence_urls,
                CAST(incident.proposed_resolution AS NVARCHAR(MAX)) AS proposed_resolution,
                CAST(incident.resolution_type AS NVARCHAR(80)) AS resolution_type,
                CAST(o.status AS NVARCHAR(80)) AS order_status,
                CAST(latest_shipment.status AS NVARCHAR(80)) AS shipment_status,
                CAST(o.payment_status AS NVARCHAR(80)) AS payment_status,
                COALESCE((
                    SELECT SUM(CASE
                        WHEN COALESCE(p.paid_amount, 0) > 0 THEN p.paid_amount
                        ELSE COALESCE(p.amount, 0)
                    END)
                    FROM payments p
                    WHERE p.order_id = o.id
                      AND UPPER(LTRIM(RTRIM(COALESCE(p.status, '')))) IN ('PAID', 'PARTIALLY_PAID', 'COMPLETED', 'CONFIRMED', 'SUCCESS')
                ), CASE
                    WHEN UPPER(LTRIM(RTRIM(COALESCE(o.payment_status, '')))) IN ('PAID', 'PARTIALLY_PAID', 'COMPLETED', 'CONFIRMED', 'SUCCESS')
                    THEN COALESCE(o.total_amount, 0)
                    ELSE 0
                END) AS total_paid
            FROM complaints c
            LEFT JOIN orders o ON o.id = c.order_id
            LEFT JOIN companies buyer ON buyer.id = o.buyer_company_id
            LEFT JOIN companies supplier ON supplier.id = o.supplier_company_id
            LEFT JOIN batches batch ON batch.id = c.batch_id
            LEFT JOIN products product ON product.id = batch.product_id
            OUTER APPLY (
                SELECT TOP 1 oi.quantity, oi.price, oi.unit, oi.product_id
                FROM order_items oi
                WHERE oi.order_id = o.id
                ORDER BY oi.id ASC
            ) first_item
            LEFT JOIN products first_item_product ON first_item_product.id = first_item.product_id
            OUTER APPLY (
                SELECT TOP 1 s.status
                FROM shipments s
                WHERE s.order_id = o.id
                ORDER BY s.created_at DESC, s.id DESC
            ) latest_shipment
            LEFT JOIN users created_user ON created_user.id = c.created_by_user_id
            LEFT JOIN users assigned_user ON assigned_user.id = c.assigned_to_user_id
            LEFT JOIN shipment_incidents incident ON incident.id = c.source_id AND c.source_type = 'SHIPMENT_INCIDENT'
            WHERE 1 = 1
            """;

    private final ComplaintRepository complaintRepository;
    private final OrderRepository orderRepository;
    private final BatchRepository batchRepository;
    private final UserRepository userRepository;
    private final ShipmentIncidentRepository shipmentIncidentRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final EscrowTransactionRepository escrowTransactionRepository;
    private final WalletAccountRepository walletAccountRepository;
    private final WalletLedgerEntryRepository walletLedgerEntryRepository;
    private final NotificationCenterService notificationCenterService;
    private final CurrentUserService currentUserService;
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
                        OR LOWER(CAST(COALESCE(c.source_type, '') AS NVARCHAR(50))) LIKE ?
                        OR LOWER(CAST(COALESCE(incident.incident_type, '') AS NVARCHAR(100))) LIKE ?
                        OR CAST(COALESCE(c.shipment_id, 0) AS NVARCHAR(50)) LIKE ?
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
            params.add(keyword);
            params.add(keyword);
            params.add(keyword);
        }

        sql.append(" ORDER BY c.created_at DESC, c.id DESC");
        List<AdminDisputeDto> disputes = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapRow(new AdminDisputeRowSnapshot(
                rs.getLong("dispute_id"),
                rs.getLong("order_id"),
                rs.getObject("batch_id") == null ? null : rs.getLong("batch_id"),
                rs.getObject("shipment_id") == null ? null : rs.getLong("shipment_id"),
                rs.getString("source_type"),
                rs.getObject("source_id") == null ? null : rs.getLong("source_id"),
                rs.getLong("created_by_user_id"),
                rs.getObject("assigned_to_user_id") == null ? null : rs.getLong("assigned_to_user_id"),
                rs.getString("dispute_status"),
                rs.getString("dispute_severity"),
                rs.getString("dispute_title"),
                rs.getString("dispute_description"),
                rs.getString("dispute_resolution"),
                rs.getString("decision_type"),
                rs.getBigDecimal("refund_amount"),
                rs.getBigDecimal("compensation_amount"),
                rs.getObject("resolved_by_user_id") == null ? null : rs.getLong("resolved_by_user_id"),
                toLocalDateTime(rs.getTimestamp("created_at")),
                toLocalDateTime(rs.getTimestamp("resolved_at")),
                rs.getString("buyer_name"),
                rs.getString("supplier_name"),
                rs.getString("product_name"),
                rs.getBigDecimal("total_amount"),
                rs.getBigDecimal("shipping_fee"),
                rs.getBigDecimal("order_item_quantity"),
                rs.getBigDecimal("order_item_price"),
                rs.getString("order_item_unit"),
                rs.getString("order_item_product_name"),
                rs.getString("created_by_name"),
                rs.getString("assigned_to_name"),
                rs.getString("incident_type"),
                rs.getString("incident_status"),
                rs.getString("buyer_evidence_urls"),
                rs.getString("supplier_response"),
                rs.getString("supplier_evidence_urls"),
                rs.getString("proposed_resolution"),
                rs.getString("resolution_type"),
                rs.getString("order_status"),
                rs.getString("shipment_status"),
                rs.getString("payment_status"),
                rs.getBigDecimal("total_paid"))), params.toArray());
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
                        rs.getObject("shipment_id") == null ? null : rs.getLong("shipment_id"),
                        rs.getString("source_type"),
                        rs.getObject("source_id") == null ? null : rs.getLong("source_id"),
                        rs.getLong("created_by_user_id"),
                        rs.getObject("assigned_to_user_id") == null ? null : rs.getLong("assigned_to_user_id"),
                        rs.getString("dispute_status"),
                        rs.getString("dispute_severity"),
                        rs.getString("dispute_title"),
                        rs.getString("dispute_description"),
                        rs.getString("dispute_resolution"),
                        rs.getString("decision_type"),
                        rs.getBigDecimal("refund_amount"),
                        rs.getBigDecimal("compensation_amount"),
                        rs.getObject("resolved_by_user_id") == null ? null : rs.getLong("resolved_by_user_id"),
                        toLocalDateTime(rs.getTimestamp("created_at")),
                        toLocalDateTime(rs.getTimestamp("resolved_at")),
                        rs.getString("buyer_name"),
                        rs.getString("supplier_name"),
                        rs.getString("product_name"),
                        rs.getBigDecimal("total_amount"),
                        rs.getBigDecimal("shipping_fee"),
                        rs.getBigDecimal("order_item_quantity"),
                        rs.getBigDecimal("order_item_price"),
                        rs.getString("order_item_unit"),
                        rs.getString("order_item_product_name"),
                        rs.getString("created_by_name"),
                        rs.getString("assigned_to_name"),
                        rs.getString("incident_type"),
                        rs.getString("incident_status"),
                        rs.getString("buyer_evidence_urls"),
                        rs.getString("supplier_response"),
                        rs.getString("supplier_evidence_urls"),
                        rs.getString("proposed_resolution"),
                        rs.getString("resolution_type"),
                        rs.getString("order_status"),
                        rs.getString("shipment_status"),
                        rs.getString("payment_status"),
                        rs.getBigDecimal("total_paid"))),
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
        Long resolvedCreatedByUserId = resolveAdminUserId(createdByUserId);
        Long resolvedAssignedToUserId = assignedToUserId == null ? resolvedCreatedByUserId : assignedToUserId;
        validateUser(resolvedCreatedByUserId, "Người tạo");
        validateUser(resolvedAssignedToUserId, "Người xử lý");

        ComplaintEntity complaint = complaintRepository.save(ComplaintEntity.builder()
                .orderId(orderId)
                .batchId(batchId)
                .sourceType(SOURCE_ADMIN_MANUAL)
                .createdByUserId(resolvedCreatedByUserId)
                .assignedToUserId(resolvedAssignedToUserId)
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
        Long resolvedCreatedByUserId = createdByUserId == null ? complaint.getCreatedByUserId() : createdByUserId;
        Long resolvedAssignedToUserId = assignedToUserId == null ? resolveAdminUserId(null) : assignedToUserId;
        validateUser(resolvedCreatedByUserId, "Người tạo");
        validateUser(resolvedAssignedToUserId, "Người xử lý");

        ComplaintStatusEnum nextStatus = parseStatusOrDefault(status);
        complaint.setOrderId(orderId);
        complaint.setBatchId(batchId);
        complaint.setCreatedByUserId(resolvedCreatedByUserId);
        complaint.setAssignedToUserId(resolvedAssignedToUserId);
        complaint.setStatus(nextStatus);
        complaint.setSeverity(normalizeSeverity(severity));
        complaint.setTitle(normalizeRequired(title, "Tiêu đề tranh chấp là bắt buộc."));
        complaint.setDescription(normalizeRequired(description, "Mô tả tranh chấp là bắt buộc."));
        complaint.setResolution(normalizeText(resolution));
        complaint.setResolvedAt(resolveResolvedAt(nextStatus));

        complaintRepository.save(complaint);
        syncLinkedIncident(complaint, nextStatus, resolution);
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

        Long resolvedAssignedToUserId = assignedToUserId == null ? resolveAdminUserId(null) : assignedToUserId;
        validateUser(resolvedAssignedToUserId, "Người xử lý");
        complaint.setAssignedToUserId(resolvedAssignedToUserId);
        complaint.setStatus(nextStatus);
        complaint.setResolution(normalizeText(resolution));
        complaint.setResolvedAt(resolveResolvedAt(nextStatus));

        complaintRepository.save(complaint);
        syncLinkedIncident(complaint, nextStatus, resolution);
        AdminDisputeDto dispute = getDisputeById(disputeId);
        log.info("Updated dispute status disputeId={} newStatus={}", disputeId, dispute.getStatus());
        return dispute;
    }

    @Override
    @Transactional
    public AdminDisputeDto resolveDispute(
            Long disputeId,
            Long assignedToUserId,
            String decisionType,
            BigDecimal refundAmount,
            BigDecimal compensationAmount,
            String resolution,
            Boolean releaseRemainingToSupplier) {
        log.info("Resolving dispute disputeId={} decisionType={} refundAmount={} compensationAmount={}",
                disputeId, decisionType, refundAmount, compensationAmount);
        ComplaintEntity complaint = complaintRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));
        if (complaint.getStatus() == ComplaintStatusEnum.RESOLVED || complaint.getStatus() == ComplaintStatusEnum.REJECTED) {
            throw new IllegalArgumentException("DISPUTE_ALREADY_CLOSED");
        }

        String normalizedDecision = normalizeDecision(decisionType);
        Long adminUserId = resolveAdminUserId(assignedToUserId);
        validateUser(adminUserId, "Admin assignee");
        OrderEntity order = orderRepository.findById(complaint.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        BigDecimal paidAmount = paidAmountForOrder(order);
        BigDecimal normalizedRefund = positiveAmount(refundAmount);
        BigDecimal normalizedCompensation = positiveAmount(compensationAmount);
        if (DECISION_FULL_REFUND.equals(normalizedDecision)) {
            normalizedRefund = paidAmount.compareTo(BigDecimal.ZERO) > 0 ? paidAmount : nullToZero(order.getTotalAmount());
        }
        if (DECISION_PARTIAL_REFUND.equals(normalizedDecision) && normalizedRefund.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("REFUND_AMOUNT_REQUIRED");
        }
        if (DECISION_COMPENSATION.equals(normalizedDecision) && normalizedCompensation.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("COMPENSATION_AMOUNT_REQUIRED");
        }
        if (normalizedRefund.compareTo(BigDecimal.ZERO) > 0 && paidAmount.compareTo(BigDecimal.ZERO) > 0
                && normalizedRefund.compareTo(paidAmount) > 0) {
            throw new IllegalArgumentException("REFUND_AMOUNT_EXCEEDS_PAID_AMOUNT");
        }

        ComplaintStatusEnum finalStatus = isClaimRejectedDecision(normalizedDecision)
                ? ComplaintStatusEnum.REJECTED
                : ComplaintStatusEnum.RESOLVED;
        String finalResolution = firstNonBlank(normalizeText(resolution), defaultResolution(normalizedDecision));
        LocalDateTime now = LocalDateTime.now();

        complaint.setAssignedToUserId(adminUserId);
        complaint.setResolvedByUserId(adminUserId);
        complaint.setStatus(finalStatus);
        complaint.setDecisionType(normalizedDecision);
        complaint.setRefundAmount(normalizedRefund.compareTo(BigDecimal.ZERO) > 0 ? normalizedRefund : null);
        complaint.setCompensationAmount(normalizedCompensation.compareTo(BigDecimal.ZERO) > 0 ? normalizedCompensation : null);
        complaint.setResolution(finalResolution);
        complaint.setResolvedAt(now);
        complaintRepository.save(complaint);

        applyDisputeDecision(order, complaint, normalizedDecision, normalizedRefund, normalizedCompensation,
                Boolean.TRUE.equals(releaseRemainingToSupplier), finalResolution, now);
        syncLinkedIncident(complaint, finalStatus, finalResolution);
        AdminDisputeDto dispute = getDisputeById(disputeId);
        log.info("Resolved dispute disputeId={} status={} decision={}", disputeId, dispute.getStatus(), normalizedDecision);
        return dispute;
    }

    @Override
    @Transactional
    public void refundDispute(Long disputeId, BigDecimal refundAmount, String reason) {
        ComplaintEntity complaint = complaintRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));
        if (complaint.getStatus() == ComplaintStatusEnum.RESOLVED || complaint.getStatus() == ComplaintStatusEnum.REJECTED) {
            throw new IllegalArgumentException("DISPUTE_ALREADY_CLOSED");
        }

        OrderEntity order = orderRepository.findById(complaint.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (order.getStatus() == OrderStatusEnum.REFUNDED
                || order.getStatus() == OrderStatusEnum.PARTIALLY_REFUNDED
                || walletLedgerEntryRepository.existsByOrderIdAndEntryType(order.getId(), "REFUND")) {
            throw new IllegalArgumentException("ORDER_ALREADY_REFUNDED");
        }

        BigDecimal paidAmount = paidAmountForOrder(order);
        if (paidAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("ORDER_NOT_PAID");
        }

        BigDecimal normalizedRefundAmount = positiveAmount(refundAmount);
        if (normalizedRefundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("REFUND_AMOUNT_REQUIRED");
        }
        if (normalizedRefundAmount.compareTo(paidAmount) > 0) {
            throw new IllegalArgumentException("REFUND_AMOUNT_EXCEEDS_PAID_AMOUNT");
        }
        if (order.getBuyerCompanyId() == null) {
            throw new IllegalArgumentException("BUYER_WALLET_NOT_FOUND");
        }

        LocalDateTime now = LocalDateTime.now();
        WalletAccountEntity buyerWallet = requireWallet(order.getBuyerCompanyId(), now);
        buyerWallet.setAvailableBalance(nullToZero(buyerWallet.getAvailableBalance()).add(normalizedRefundAmount));
        buyerWallet.setUpdatedAt(now);
        walletAccountRepository.save(buyerWallet);
        appendWalletLedger(buyerWallet, order.getId(), normalizedRefundAmount, "REFUND", "Refund Order #" + order.getId(), now);

        boolean fullRefund = normalizedRefundAmount.compareTo(paidAmount) == 0;
        order.setStatus(fullRefund ? OrderStatusEnum.REFUNDED : OrderStatusEnum.PARTIALLY_REFUNDED);
        order.setEscrowStatus(fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED");
        order.setUpdatedAt(now);
        orderRepository.save(order);

        paymentRepository.findByOrderIdOrderByPaymentDateDesc(order.getId()).forEach(payment -> {
            if (isPaidPayment(payment)) {
                payment.setEscrowStatus(fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED");
                if (fullRefund) {
                    payment.setStatus("REFUNDED");
                }
                payment.setNote(appendNote(payment.getNote(), "Admin refund: " + formatMoney(normalizedRefundAmount)));
                payment.setUpdatedAt(now);
                paymentRepository.save(payment);
            }
        });

        Long adminUserId = resolveAdminUserId(null);
        String normalizedReason = firstNonBlank(normalizeText(reason), "Supplier không giao hàng.");
        String resolution = "Admin đã hoàn tiền cho Buyer số tiền " + formatMoney(normalizedRefundAmount)
                + " do " + normalizedReason;
        complaint.setAssignedToUserId(adminUserId);
        complaint.setResolvedByUserId(adminUserId);
        complaint.setStatus(ComplaintStatusEnum.RESOLVED);
        complaint.setDecisionType(fullRefund ? DECISION_FULL_REFUND : DECISION_PARTIAL_REFUND);
        complaint.setRefundAmount(normalizedRefundAmount);
        complaint.setResolution(resolution);
        complaint.setResolvedAt(now);
        complaintRepository.save(complaint);

        appendEscrowTransaction(order, null, normalizedRefundAmount, "ADMIN_REFUND", "Refund Order #" + order.getId(), now);
        appendOrderEvent(complaint.getShipmentId(), "DISPUTE_REFUND", resolution, now);
        syncLinkedIncident(complaint, ComplaintStatusEnum.RESOLVED, resolution);
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
        String sourceType = resolveSourceType(row.sourceType());
        return AdminDisputeDto.builder()
                .id(row.id())
                .orderId(row.orderId())
                .batchId(row.batchId())
                .shipmentId(row.shipmentId())
                .sourceType(sourceType)
                .sourceLabel(toSourceLabel(sourceType))
                .sourceId(row.sourceId())
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
                .decisionType(row.decisionType())
                .refundAmount(row.refundAmount())
                .compensationAmount(row.compensationAmount())
                .resolvedByUserId(row.resolvedByUserId())
                .buyerName(firstNonBlank(row.buyerName(), "Chưa xác định"))
                .supplierName(firstNonBlank(row.supplierName(), "Chưa xác định"))
                .product(firstNonBlank(row.product(), row.orderItemProduct(), "Chưa xác định"))
                .amount(formatMoney(row.totalAmount()))
                .totalPaid(nullToZero(row.totalPaid()))
                .orderQuantity(nullToZero(row.orderQuantity()))
                .orderItemUnit(firstNonBlank(row.orderItemUnit(), "kg"))
                .unitPrice(nullToZero(row.unitPrice()))
                .shippingFee(nullToZero(row.shippingFee()))
                .orderStatus(row.orderStatus())
                .shipmentStatus(row.shipmentStatus())
                .paymentStatus(row.paymentStatus())
                .canRefund(canRefund(row))
                .incidentType(row.incidentType())
                .incidentStatus(row.incidentStatus())
                .incidentStatusLabel(toIncidentStatusLabel(row.incidentStatus()))
                .buyerEvidenceUrls(row.buyerEvidenceUrls())
                .supplierResponse(row.supplierResponse())
                .supplierEvidenceUrls(row.supplierEvidenceUrls())
                .proposedResolution(row.proposedResolution())
                .resolutionType(row.resolutionType())
                .createdByName(firstNonBlank(row.createdByName(), "Chưa xác định"))
                .assignedToName(firstNonBlank(row.assignedToName(), "Chưa phân công"))
                .createdAt(row.createdAt() == null ? null : row.createdAt().format(DATE_FORMATTER))
                .resolvedAt(row.resolvedAt() == null ? null : row.resolvedAt().format(DATE_FORMATTER))
                .build();
    }

    private void applyDisputeDecision(
            OrderEntity order,
            ComplaintEntity complaint,
            String decisionType,
            BigDecimal refundAmount,
            BigDecimal compensationAmount,
            boolean releaseRemainingToSupplier,
            String resolution,
            LocalDateTime now) {
        switch (decisionType) {
            case DECISION_REJECT_CLAIM, DECISION_RELEASE_TO_SUPPLIER -> releaseToSupplier(order, complaint, resolution, now);
            case DECISION_FULL_REFUND -> refundOrder(order, complaint, refundAmount, true, resolution, now);
            case DECISION_PARTIAL_REFUND -> {
                refundOrder(order, complaint, refundAmount, false, resolution, now);
                if (releaseRemainingToSupplier) {
                    appendEscrowTransaction(order, null, nullToZero(order.getTotalAmount()).subtract(refundAmount).max(BigDecimal.ZERO),
                            "ADMIN_RELEASE_REMAINING", "Admin release remaining escrow after partial refund for dispute #" + complaint.getId(), now);
                }
            }
            case DECISION_COMPENSATION -> compensateOrder(order, complaint, compensationAmount, releaseRemainingToSupplier, resolution, now);
            case DECISION_REPLACEMENT -> createReplacementShipment(order, complaint, resolution, now);
            default -> throw new IllegalArgumentException("DISPUTE_DECISION_INVALID");
        }
    }

    private void releaseToSupplier(OrderEntity order, ComplaintEntity complaint, String resolution, LocalDateTime now) {
        order.setStatus(OrderStatusEnum.COMPLETED);
        order.setEscrowStatus("RELEASED");
        order.setCompletedAt(firstDate(order.getCompletedAt(), now));
        order.setUpdatedAt(now);
        orderRepository.save(order);

        paymentRepository.findByOrderIdOrderByPaymentDateDesc(order.getId()).forEach(payment -> {
            if (isPaidPayment(payment)) {
                payment.setEscrowStatus("RELEASED");
                payment.setUpdatedAt(now);
                paymentRepository.save(payment);
                appendEscrowTransaction(order, payment.getId(), nullToZero(payment.getPaidAmount()),
                        "ADMIN_RELEASE", "Admin released escrow after dispute #" + complaint.getId(), now);
            }
        });
        appendOrderEvent(complaint.getShipmentId(), "DISPUTE_RELEASED", firstNonBlank(resolution, "Admin released escrow to supplier"), now);
        notifyDisputeBusinessDecision(order, complaint, "Admin da tu choi khieu nai va release tien cho nha cung cap.", resolution);
    }

    private void refundOrder(OrderEntity order, ComplaintEntity complaint, BigDecimal amount, boolean fullRefund, String resolution, LocalDateTime now) {
        BigDecimal refundAmount = positiveAmount(amount);
        order.setStatus(fullRefund ? OrderStatusEnum.REFUNDED : OrderStatusEnum.REFUND_PENDING);
        order.setEscrowStatus(fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED");
        order.setUpdatedAt(now);
        orderRepository.save(order);

        paymentRepository.findByOrderIdOrderByPaymentDateDesc(order.getId()).forEach(payment -> {
            if (isPaidPayment(payment)) {
                payment.setEscrowStatus(fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED");
                if (fullRefund) {
                    payment.setStatus("REFUNDED");
                }
                payment.setNote(appendNote(payment.getNote(), "Admin dispute refund approved: " + formatMoney(refundAmount)));
                payment.setUpdatedAt(now);
                paymentRepository.save(payment);
            }
        });

        invoiceRepository.findTopByOrderIdOrderByCreatedAtDesc(order.getId()).ifPresent(invoice -> {
            if (fullRefund) {
                invoice.setStatus(InvoiceStatusEnum.VOIDED);
            } else {
                invoice.setAdjustedAmount(nullToZero(invoice.getAdjustedAmount()).subtract(refundAmount));
            }
            invoiceRepository.save(invoice);
        });

        appendEscrowTransaction(order, null, refundAmount, fullRefund ? "ADMIN_FULL_REFUND" : "ADMIN_PARTIAL_REFUND",
                "Admin approved refund for dispute #" + complaint.getId(), now);
        appendOrderEvent(complaint.getShipmentId(), fullRefund ? "DISPUTE_FULL_REFUND" : "DISPUTE_PARTIAL_REFUND",
                firstNonBlank(resolution, "Admin approved refund " + formatMoney(refundAmount)), now);
        notifyDisputeBusinessDecision(order, complaint, fullRefund
                ? "Admin da chap thuan hoan tien toan bo cho tranh chap."
                : "Admin da chap thuan hoan tien mot phan cho tranh chap.", resolution);
    }

    private void compensateOrder(OrderEntity order, ComplaintEntity complaint, BigDecimal amount, boolean releaseRemainingToSupplier, String resolution, LocalDateTime now) {
        BigDecimal compensation = positiveAmount(amount);
        order.setStatus(releaseRemainingToSupplier ? OrderStatusEnum.COMPLETED : OrderStatusEnum.WAITING_BUYER_CONFIRM);
        order.setEscrowStatus(releaseRemainingToSupplier ? "PARTIALLY_RELEASED" : "COMPENSATION_APPROVED");
        order.setUpdatedAt(now);
        orderRepository.save(order);

        appendEscrowTransaction(order, null, compensation, "ADMIN_COMPENSATION",
                "Admin approved compensation for dispute #" + complaint.getId(), now);
        if (releaseRemainingToSupplier) {
            appendEscrowTransaction(order, null, nullToZero(order.getTotalAmount()).subtract(compensation).max(BigDecimal.ZERO),
                    "ADMIN_RELEASE_REMAINING", "Admin released remaining escrow after compensation for dispute #" + complaint.getId(), now);
        }
        appendOrderEvent(complaint.getShipmentId(), "DISPUTE_COMPENSATION",
                firstNonBlank(resolution, "Admin approved compensation " + formatMoney(compensation)), now);
        notifyDisputeBusinessDecision(order, complaint, "Admin da chap thuan boi hoan cho tranh chap.", resolution);
    }

    private void createReplacementShipment(OrderEntity order, ComplaintEntity complaint, String resolution, LocalDateTime now) {
        ShipmentEntity sourceShipment = resolveSourceShipment(order, complaint);
        if (sourceShipment == null) {
            throw new IllegalArgumentException("SHIPMENT_REQUIRED_FOR_REPLACEMENT");
        }
        sourceShipment.setStatus(ShipmentStatusEnum.WAITING_REPLACEMENT);
        sourceShipment.setIncidentNote(appendNote(sourceShipment.getIncidentNote(), firstNonBlank(resolution, "Admin yeu cau giao bu")));
        sourceShipment.setUpdatedAt(now);
        sourceShipment.setLastStatusChangedAt(now);
        shipmentRepository.save(sourceShipment);

        ShipmentEntity replacement = ShipmentEntity.builder()
                .orderId(order.getId())
                .parentShipmentId(sourceShipment.getId())
                .shipmentType("REPLACEMENT")
                .replacementIncidentId(complaint.getSourceId())
                .carrierName(sourceShipment.getCarrierName())
                .providerCode(sourceShipment.getProviderCode())
                .providerName(sourceShipment.getProviderName())
                .serviceName(sourceShipment.getServiceName())
                .receiverName(sourceShipment.getReceiverName())
                .receiverPhone(sourceShipment.getReceiverPhone())
                .receiverProvince(sourceShipment.getReceiverProvince())
                .receiverDistrict(sourceShipment.getReceiverDistrict())
                .receiverWard(sourceShipment.getReceiverWard())
                .receiverAddress(sourceShipment.getReceiverAddress())
                .shippingMethod(sourceShipment.getShippingMethod())
                .shippingPayer("SUPPLIER")
                .status(ShipmentStatusEnum.PREPARING)
                .shippingFee(BigDecimal.ZERO)
                .weight(sourceShipment.getWeight())
                .length(sourceShipment.getLength())
                .width(sourceShipment.getWidth())
                .height(sourceShipment.getHeight())
                .fromDistrictId(sourceShipment.getFromDistrictId())
                .fromWardCode(sourceShipment.getFromWardCode())
                .toDistrictId(sourceShipment.getToDistrictId())
                .toWardCode(sourceShipment.getToWardCode())
                .serviceTypeId(sourceShipment.getServiceTypeId())
                .serviceId(sourceShipment.getServiceId())
                .autoProgressEnabled(false)
                .demoTrackingEnabled(false)
                .lastStatusChangedAt(now)
                .progress(10)
                .feeConfirmed(true)
                .incidentNote(firstNonBlank(resolution, "Giao bu cho tranh chap #" + complaint.getId()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        replacement = shipmentRepository.save(replacement);

        order.setStatus(OrderStatusEnum.PREPARING);
        order.setEscrowStatus(firstNonBlank(order.getEscrowStatus(), "HELD"));
        order.setUpdatedAt(now);
        orderRepository.save(order);

        appendOrderEvent(sourceShipment.getId(), "WAITING_REPLACEMENT", "Admin yeu cau giao bu, shipment moi: SH-" + replacement.getId(), now);
        appendOrderEvent(replacement.getId(), ShipmentStatusEnum.PREPARING.name(), "Shipment giao bu duoc tao tu tranh chap #" + complaint.getId(), now);
        appendEscrowTransaction(order, null, BigDecimal.ZERO, "ADMIN_REPLACEMENT",
                "Admin approved replacement shipment #" + replacement.getId() + " for dispute #" + complaint.getId(), now);
        notifyDisputeBusinessDecision(order, complaint, "Admin da yeu cau nha cung cap giao bu cho tranh chap.", resolution);
    }

    private void syncLinkedIncident(ComplaintEntity complaint, ComplaintStatusEnum status, String resolution) {
        if (complaint == null
                || !SOURCE_SHIPMENT_INCIDENT.equalsIgnoreCase(complaint.getSourceType())
                || complaint.getSourceId() == null) {
            return;
        }
        if (status != ComplaintStatusEnum.RESOLVED && status != ComplaintStatusEnum.REJECTED) {
            return;
        }

        shipmentIncidentRepository.findById(complaint.getSourceId()).ifPresent(incident -> {
            LocalDateTime now = LocalDateTime.now();
            String note = normalizeText(resolution);
            if (status == ComplaintStatusEnum.RESOLVED) {
                incident.setStatus("RESOLVED");
                incident.setResolvedAt(now);
                incident.setResolutionNote(firstNonBlank(note, "Admin da giai quyet tranh chap."));
            } else {
                incident.setStatus("REJECTED");
                incident.setResolvedAt(now);
                incident.setResolutionNote(firstNonBlank(note, "Admin da tu choi khieu nai."));
            }
            incident.setUpdatedAt(now);
            shipmentIncidentRepository.save(incident);
            if (normalizeText(complaint.getDecisionType()) == null) {
                notifyDisputeDecision(complaint, status, note);
            }
        });
    }

    private void notifyDisputeDecision(ComplaintEntity complaint, ComplaintStatusEnum status, String resolution) {
        if (complaint.getOrderId() == null) {
            return;
        }
        orderRepository.findById(complaint.getOrderId()).ifPresent(order -> {
            String actionText = status == ComplaintStatusEnum.RESOLVED ? "da duoc giai quyet" : "da bi tu choi";
            String body = "Tranh chap don #" + order.getId() + " " + actionText + "."
                    + (resolution == null ? "" : " Ghi chu: " + resolution);
            String buyerUrl = complaint.getShipmentId() == null ? "/buyer/orders?orderId=" + order.getId() : "/buyer/delivery?shipmentId=" + complaint.getShipmentId();
            String supplierUrl = complaint.getShipmentId() == null ? "/supplier/orders?orderId=" + order.getId() : "/supplier/delivery?shipmentId=" + complaint.getShipmentId();
            notifyOrderCompany(order, order.getBuyerCompanyId(), "Buyer", status, body, buyerUrl);
            notifyOrderCompany(order, order.getSupplierCompanyId(), "Supplier", status, body, supplierUrl);
        });
    }

    private void notifyOrderCompany(OrderEntity order, Long companyId, String audience, ComplaintStatusEnum status, String body, String actionUrl) {
        if (companyId == null) {
            return;
        }
        notificationCenterService.notifyCompanyOwner(
                companyId,
                NotificationTypeEnum.DELIVERY_DISPUTE,
                "Ket qua xu ly tranh chap",
                body,
                "COMPLAINT",
                actionUrl,
                "COMPLAINT",
                order.getId(),
                false,
                Map.of("orderId", order.getId(), "audience", audience, "status", status.name()));
    }

    private void notifyDisputeBusinessDecision(OrderEntity order, ComplaintEntity complaint, String body, String resolution) {
        String suffix = normalizeText(resolution) == null ? "" : " Ghi chu: " + resolution;
        String buyerUrl = complaint.getShipmentId() == null ? "/buyer/orders?orderId=" + order.getId() : "/buyer/delivery?shipmentId=" + complaint.getShipmentId();
        String supplierUrl = complaint.getShipmentId() == null ? "/supplier/orders?orderId=" + order.getId() : "/supplier/delivery?shipmentId=" + complaint.getShipmentId();
        notifyBusinessDecisionCompany(order, order.getBuyerCompanyId(), "Buyer", body + suffix, buyerUrl, complaint);
        notifyBusinessDecisionCompany(order, order.getSupplierCompanyId(), "Supplier", body + suffix, supplierUrl, complaint);
    }

    private void notifyBusinessDecisionCompany(OrderEntity order, Long companyId, String audience, String body, String actionUrl, ComplaintEntity complaint) {
        if (companyId == null) {
            return;
        }
        notificationCenterService.notifyCompanyOwner(
                companyId,
                NotificationTypeEnum.DELIVERY_DISPUTE,
                "Ket qua xu ly tranh chap",
                body,
                "COMPLAINT",
                actionUrl,
                "COMPLAINT",
                complaint.getId(),
                false,
                Map.of(
                        "orderId", order.getId(),
                        "complaintId", complaint.getId(),
                        "audience", audience,
                        "decisionType", firstNonBlank(complaint.getDecisionType(), "STATUS_ONLY")));
    }

    private String normalizeDecision(String decisionType) {
        String normalized = normalizeText(decisionType);
        if (normalized == null) {
            throw new IllegalArgumentException("DISPUTE_DECISION_REQUIRED");
        }
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (List.of(
                DECISION_REJECT_CLAIM,
                DECISION_RELEASE_TO_SUPPLIER,
                DECISION_FULL_REFUND,
                DECISION_PARTIAL_REFUND,
                DECISION_COMPENSATION,
                DECISION_REPLACEMENT).contains(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("DISPUTE_DECISION_INVALID");
    }

    private boolean isClaimRejectedDecision(String decisionType) {
        return DECISION_REJECT_CLAIM.equals(decisionType) || DECISION_RELEASE_TO_SUPPLIER.equals(decisionType);
    }

    private String defaultResolution(String decisionType) {
        return switch (decisionType) {
            case DECISION_REJECT_CLAIM -> "Admin rejected the claim.";
            case DECISION_RELEASE_TO_SUPPLIER -> "Admin released escrow to supplier.";
            case DECISION_FULL_REFUND -> "Admin approved a full refund.";
            case DECISION_PARTIAL_REFUND -> "Admin approved a partial refund.";
            case DECISION_COMPENSATION -> "Admin approved compensation.";
            case DECISION_REPLACEMENT -> "Admin approved replacement delivery.";
            default -> "Admin resolved the dispute.";
        };
    }

    private BigDecimal paidAmountForOrder(OrderEntity order) {
        if (order == null || order.getId() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal paidAmount = paymentRepository.findByOrderIdOrderByPaymentDateDesc(order.getId()).stream()
                .filter(this::isPaidPayment)
                .map(payment -> nullToZero(payment.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0
                        ? nullToZero(payment.getPaidAmount())
                        : nullToZero(payment.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (paidAmount.compareTo(BigDecimal.ZERO) > 0) {
            return paidAmount;
        }
        if (isPaidStatus(order.getPaymentStatus())) {
            return nullToZero(order.getTotalAmount());
        }
        return BigDecimal.ZERO;
    }

    private boolean isPaidPayment(PaymentEntity payment) {
        return payment != null
                && payment.getStatus() != null
                && isPaidStatus(payment.getStatus());
    }

    private boolean isPaidStatus(String status) {
        return status != null && PAID_PAYMENT_STATUSES.contains(status.trim().toUpperCase(Locale.ROOT));
    }

    private BigDecimal positiveAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return amount;
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private LocalDateTime firstDate(LocalDateTime value, LocalDateTime fallback) {
        return value == null ? fallback : value;
    }

    private void appendEscrowTransaction(OrderEntity order, Long paymentId, BigDecimal amount, String type, String description, LocalDateTime now) {
        escrowTransactionRepository.save(EscrowTransactionEntity.builder()
                .orderId(order.getId())
                .paymentId(paymentId)
                .buyerCompanyId(order.getBuyerCompanyId())
                .supplierCompanyId(order.getSupplierCompanyId())
                .amount(nullToZero(amount))
                .transactionType(type)
                .status("COMPLETED")
                .description(description)
                .createdAt(now)
                .build());
    }

    private WalletAccountEntity requireWallet(Long companyId, LocalDateTime now) {
        return walletAccountRepository.findByCompanyId(companyId)
                .orElseGet(() -> walletAccountRepository.save(WalletAccountEntity.builder()
                        .companyId(companyId)
                        .availableBalance(BigDecimal.ZERO)
                        .pendingBalance(BigDecimal.ZERO)
                        .totalEarned(BigDecimal.ZERO)
                        .totalWithdrawn(BigDecimal.ZERO)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()));
    }

    private void appendWalletLedger(WalletAccountEntity wallet, Long orderId, BigDecimal amount, String type, String description, LocalDateTime now) {
        walletLedgerEntryRepository.save(WalletLedgerEntryEntity.builder()
                .walletAccountId(wallet.getId())
                .companyId(wallet.getCompanyId())
                .orderId(orderId)
                .entryType(type)
                .amount(amount)
                .balanceAfter(nullToZero(wallet.getAvailableBalance()))
                .description(description)
                .createdAt(now)
                .build());
    }

    private boolean canRefund(AdminDisputeRowSnapshot row) {
        ComplaintStatusEnum status = parseStatus(row.status());
        String orderStatus = normalizeText(row.orderStatus());
        return status != ComplaintStatusEnum.RESOLVED
                && status != ComplaintStatusEnum.REJECTED
                && nullToZero(row.totalPaid()).compareTo(BigDecimal.ZERO) > 0
                && !"REFUNDED".equalsIgnoreCase(orderStatus)
                && !"PARTIALLY_REFUNDED".equalsIgnoreCase(orderStatus);
    }

    private void appendOrderEvent(Long shipmentId, String status, String description, LocalDateTime now) {
        if (shipmentId == null) {
            return;
        }
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipmentId)
                .status(status)
                .description(description)
                .eventTime(now)
                .build());
    }

    private ShipmentEntity resolveSourceShipment(OrderEntity order, ComplaintEntity complaint) {
        if (complaint.getShipmentId() != null) {
            return shipmentRepository.findById(complaint.getShipmentId()).orElse(null);
        }
        return shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(order.getId()).orElse(null);
    }

    private String appendNote(String existing, String note) {
        String normalizedNote = normalizeText(note);
        if (normalizedNote == null) {
            return existing;
        }
        String normalizedExisting = normalizeText(existing);
        return normalizedExisting == null ? normalizedNote : normalizedExisting + "\n---\n" + normalizedNote;
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
            throw new IllegalArgumentException(label + " không được để trống.");
        }
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException(label + " không tồn tại.");
        }
    }

    private Long resolveAdminUserId(Long requestedUserId) {
        return requestedUserId == null ? currentUserService.requireCurrentUser().getId() : requestedUserId;
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

    private String resolveSourceType(String sourceType) {
        String normalized = normalizeText(sourceType);
        return normalized == null ? SOURCE_ORDER_COMPLAINT : normalized.toUpperCase(Locale.ROOT);
    }

    private String toSourceLabel(String sourceType) {
        if (SOURCE_SHIPMENT_INCIDENT.equalsIgnoreCase(sourceType)) {
            return "Su co giao hang";
        }
        if (SOURCE_ADMIN_MANUAL.equalsIgnoreCase(sourceType)) {
            return "Admin tao";
        }
        return "Khieu nai don hang";
    }

    private String toIncidentStatusLabel(String status) {
        String normalized = normalizeText(status);
        if (normalized == null) {
            return null;
        }
        return switch (normalized.toUpperCase(Locale.ROOT)) {
            case "WAITING_SUPPLIER_RESPONSE" -> "Cho nha cung cap phan hoi";
            case "WAITING_BUYER_CONFIRMATION" -> "Cho buyer xac nhan";
            case "NEGOTIATING" -> "Dang thuong luong";
            case "ESCALATED" -> "Da chuyen admin";
            case "RESOLVED" -> "Da giai quyet";
            default -> normalized;
        };
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
        return status == ComplaintStatusEnum.RESOLVED || status == ComplaintStatusEnum.REJECTED ? LocalDateTime.now() : null;
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
            Long shipmentId,
            String sourceType,
            Long sourceId,
            Long createdByUserId,
            Long assignedToUserId,
            String status,
            String severity,
            String title,
            String description,
            String resolution,
            String decisionType,
            BigDecimal refundAmount,
            BigDecimal compensationAmount,
            Long resolvedByUserId,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt,
            String buyerName,
            String supplierName,
            String product,
            BigDecimal totalAmount,
            BigDecimal shippingFee,
            BigDecimal orderQuantity,
            BigDecimal unitPrice,
            String orderItemUnit,
            String orderItemProduct,
            String createdByName,
            String assignedToName,
            String incidentType,
            String incidentStatus,
            String buyerEvidenceUrls,
            String supplierResponse,
            String supplierEvidenceUrls,
            String proposedResolution,
            String resolutionType,
            String orderStatus,
            String shipmentStatus,
            String paymentStatus,
            BigDecimal totalPaid) {
    }
}
