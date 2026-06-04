package com.agribridge.backend.service.impl;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.RfqTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.NotificationCenterService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationCenterServiceImpl implements NotificationCenterService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void notifyCompanyOwner(
            Long companyId,
            NotificationTypeEnum type,
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata) {
        NotificationEntity notification = saveCompanyOwnerNotification(
                companyId,
                type,
                title,
                body,
                module,
                actionUrl,
                entityType,
                entityId,
                actionRequired,
                metadata);
        if (notification != null) {
            pushRealtime(notification);
        }
    }

    @Override
    public NotificationEntity saveCompanyOwnerNotification(
            Long companyId,
            NotificationTypeEnum type,
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata) {
        if (companyId == null || type == null) return null;
        return userRepository.findFirstByCompanyIdAndRole(companyId, UserRoleEnum.OWNER)
                .or(() -> userRepository.findFirstByCompanyIdOrderByCreatedAtAsc(companyId))
                .map(owner -> save(owner, companyId, type, title, body, module, actionUrl, entityType, entityId, actionRequired, metadata))
                .orElse(null);
    }

    @Override
    public void notifyAdmins(
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata) {
        Map<String, Object> adminMetadata = new LinkedHashMap<>();
        adminMetadata.put("role", "admin");
        if (metadata != null) {
            adminMetadata.putAll(metadata);
        }
        userRepository.findActiveAdminUsers().forEach(admin -> {
            NotificationEntity notification = save(
                    admin,
                    admin.getCompanyId(),
                    NotificationTypeEnum.SYSTEM,
                    title,
                    body,
                    module,
                    actionUrl,
                    entityType,
                    entityId,
                    actionRequired,
                    adminMetadata);
            pushRealtime(notification);
        });
    }

    @Override
    public void notifySupplierOrderCreated(OrderEntity order, String buyerName) {
        if (order == null) return;
        String orderCode = orderCode(order.getId());
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.ORDER_CREATED_FOR_SUPPLIER,
                "Bạn có đơn mới " + orderCode,
                firstText(buyerName, "Buyer") + " vừa tạo đơn hàng. Vui lòng xác nhận hoặc từ chối đơn hàng.",
                "ORDER",
                "/supplier/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                true,
                orderMeta(order, "supplier", Map.of("buyerName", firstText(buyerName, "Buyer"))));
    }

    @Override
    public void notifyBuyerOrderConfirmed(OrderEntity order, String supplierName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.ORDER_CONFIRMED_FOR_BUYER,
                "Đơn " + orderCode(order.getId()) + " đã được xác nhận",
                "Đơn hàng đã được " + firstText(supplierName, "nhà cung cấp") + " xác nhận.",
                "ORDER",
                "/buyer/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                false,
                orderMeta(order, "buyer", Map.of("supplierName", firstText(supplierName, "Nhà cung cấp"))));
    }

    @Override
    public void notifyBuyerOrderCancelled(OrderEntity order, String supplierName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.ORDER_CANCELLED_FOR_BUYER,
                "Đơn " + orderCode(order.getId()) + " đã bị hủy",
                firstText(supplierName, "Nhà cung cấp") + " đã từ chối/hủy đơn hàng.",
                "ORDER",
                "/buyer/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                true,
                orderMeta(order, "buyer", Map.of("supplierName", firstText(supplierName, "Nhà cung cấp"))));
    }

    @Override
    public void notifySupplierOrderCancelledByBuyer(OrderEntity order, String buyerName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.ORDER_CANCELLED_BY_BUYER_FOR_SUPPLIER,
                "Buyer đã hủy đơn " + orderCode(order.getId()),
                firstText(buyerName, "Buyer") + " đã hủy đơn hàng.",
                "ORDER",
                "/supplier/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                true,
                orderMeta(order, "supplier", Map.of("buyerName", firstText(buyerName, "Buyer"))));
    }

    @Override
    public void notifySupplierDepositPaid(OrderEntity order, BigDecimal amount, String buyerName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.PAYMENT_DEPOSIT_PAID_FOR_SUPPLIER,
                "Buyer đã thanh toán cọc",
                firstText(buyerName, "Buyer") + " đã thanh toán cọc 50% cho đơn " + orderCode(order.getId()) + ". Bạn có thể bắt đầu chuẩn bị hàng.",
                "PAYMENT",
                "/supplier/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                false,
                orderMeta(order, "supplier", Map.of("amount", nullToZero(amount), "buyerName", firstText(buyerName, "Buyer"))));
    }

    @Override
    public void notifySupplierRemainingPaid(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, String buyerName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.PAYMENT_REMAINING_PAID_FOR_SUPPLIER,
                "Buyer đã thanh toán phần còn lại",
                firstText(buyerName, "Buyer") + " đã thanh toán phần còn lại " + money(amount) + " cho đơn " + orderCode(order.getId()) + ".",
                "PAYMENT",
                "/supplier/debt?buyerId=" + order.getBuyerCompanyId() + "&invoiceId=" + id(invoice),
                "INVOICE",
                id(invoice),
                false,
                invoiceMeta(order, invoice, "supplier", Map.of("amount", nullToZero(amount), "buyerName", firstText(buyerName, "Buyer"))));
    }

    @Override
    public void notifyBuyerPaymentCompleted(OrderEntity order) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.PAYMENT_COMPLETED_FOR_BUYER,
                "Đơn " + orderCode(order.getId()) + " đã thanh toán đủ",
                "Đơn hàng đã ghi nhận đủ thanh toán.",
                "PAYMENT",
                "/buyer/orders?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                false,
                orderMeta(order, "buyer", Map.of()));
    }

    @Override
    public void notifyBuyerDeliveryInTransit(OrderEntity order) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.DELIVERY_IN_TRANSIT_FOR_BUYER,
                "Đơn " + orderCode(order.getId()) + " đang vận chuyển",
                "Đơn hàng đang được vận chuyển.",
                "DELIVERY",
                "/buyer/delivery?orderId=" + order.getId(),
                "ORDER",
                order.getId(),
                false,
                orderMeta(order, "buyer", Map.of()));
    }

    @Override
    public void notifyBuyerDeliveryWaitingConfirmation(OrderEntity order) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.DELIVERY_WAITING_CONFIRMATION_FOR_BUYER,
                "Đơn " + orderCode(order.getId()) + " đã giao thành công",
                "Vui lòng xác nhận đã nhận hàng.",
                "DELIVERY",
                "/buyer/orders?orderId=" + order.getId() + "&confirmReceived=1",
                "ORDER",
                order.getId(),
                true,
                orderMeta(order, "buyer", Map.of("targetModal", "BUYER_CONFIRM_RECEIVED_MODAL")));
    }

    @Override
    public void notifyDeliveryFailed(OrderEntity order) {
        if (order == null) return;
        String body = "Đơn " + orderCode(order.getId()) + " giao thất bại. Vui lòng kiểm tra chi tiết.";
        notifyCompanyOwner(order.getBuyerCompanyId(), NotificationTypeEnum.DELIVERY_FAILED, "Giao hàng thất bại", body,
                "DELIVERY", "/buyer/delivery?orderId=" + order.getId(), "ORDER", order.getId(), true, orderMeta(order, "buyer", Map.of()));
        notifyCompanyOwner(order.getSupplierCompanyId(), NotificationTypeEnum.DELIVERY_FAILED, "Giao hàng thất bại", body,
                "DELIVERY", "/supplier/orders?orderId=" + order.getId(), "ORDER", order.getId(), true, orderMeta(order, "supplier", Map.of()));
    }

    @Override
    public void notifyBuyerPaymentRemainingRequired(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, LocalDate dueDate) {
        if (order == null || invoice == null) return;
        String dueLabel = dueDate == null ? "chưa xác định" : dueDate.format(DATE_FORMATTER);
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.PAYMENT_REMAINING_REQUIRED,
                "Cần thanh toán phần còn lại",
                "Đơn " + orderCode(order.getId()) + " còn phải thanh toán " + money(amount) + " trước ngày " + dueLabel + ".",
                "DEBT",
                "/buyer/debt?supplierId=" + order.getSupplierCompanyId() + "&invoiceId=" + invoice.getId() + "&pay=1",
                "INVOICE",
                invoice.getId(),
                true,
                invoiceMeta(order, invoice, "buyer", Map.of("amount", nullToZero(amount), "dueDate", dueDate == null ? "" : dueDate.toString(), "targetModal", "BUYER_PAYMENT_INSTRUCTION_MODAL")));
    }

    @Override
    public void notifySupplierDebtOverdue(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, LocalDate dueDate) {
        if (order == null || invoice == null) return;
        String dueLabel = dueDate == null ? "chưa xác định" : dueDate.format(DATE_FORMATTER);
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.DEBT_OVERDUE,
                "Công nợ quá hạn",
                "Đơn " + orderCode(order.getId()) + " đã quá hạn thanh toán phần còn lại " + money(amount) + ". Hạn thanh toán: " + dueLabel + ".",
                "DEBT",
                "/supplier/debt?buyerId=" + order.getBuyerCompanyId() + "&invoiceId=" + invoice.getId(),
                "INVOICE",
                invoice.getId(),
                true,
                invoiceMeta(order, invoice, "supplier", Map.of("amount", nullToZero(amount), "dueDate", dueDate == null ? "" : dueDate.toString())));
    }

    @Override
    public void notifySuppliersNewRfq(RfqEntity rfq, String buyerName) {
        if (rfq == null) return;
        Set<Long> supplierIds = eligibleSupplierIds(rfq);
        log.debug("RFQ supplier notification targets resolved rfqId={} type={} supplierCount={} supplierIds={}",
                rfq.getId(), rfq.getType(), supplierIds.size(), supplierIds);
        for (Long supplierId : supplierIds) {
            notifyCompanyOwner(
                    supplierId,
                    NotificationTypeEnum.RFQ_CREATED_FOR_SUPPLIER,
                    "Có yêu cầu báo giá mới",
                    "Có yêu cầu báo giá mới từ " + firstText(buyerName, "Buyer") + ".",
                    "RFQ",
                    "/supplier/rfq?rfqId=" + rfq.getId(),
                    "RFQ",
                    rfq.getId(),
                    true,
                    rfqMeta(rfq, "supplier", Map.of("buyerName", firstText(buyerName, "Buyer"))));
        }
    }

    @Override
    public void notifyBuyerQuoteSubmitted(RfqEntity rfq, QuoteEntity quote, String supplierName) {
        if (rfq == null || quote == null) return;
        notifyCompanyOwner(
                rfq.getBuyerCompanyId(),
                NotificationTypeEnum.RFQ_QUOTE_SENT_FOR_BUYER,
                "Nhà cung cấp đã gửi báo giá",
                firstText(supplierName, "Nhà cung cấp") + " đã gửi báo giá cho yêu cầu RFQ của bạn.",
                "RFQ",
                "/buyer/rfq?rfqId=" + rfq.getId() + "&quoteId=" + quote.getId(),
                "QUOTE",
                quote.getId(),
                true,
                rfqMeta(rfq, "buyer", Map.of("quoteId", quote.getId(), "supplierCompanyId", quote.getSupplierCompanyId(), "supplierName", firstText(supplierName, "Nhà cung cấp"))));
    }

    @Override
    public void notifySupplierQuoteSelected(RfqEntity rfq, QuoteEntity quote, OrderEntity order) {
        if (rfq == null || quote == null) return;
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("quoteId", quote.getId());
        if (order != null) metadata.put("orderId", order.getId());
        notifyCompanyOwner(
                quote.getSupplierCompanyId(),
                NotificationTypeEnum.RFQ_QUOTE_SELECTED_FOR_SUPPLIER,
                "Báo giá của bạn đã được chọn",
                "Buyer đã chọn báo giá của bạn.",
                "QUOTE",
                order == null ? "/supplier/rfq?rfqId=" + rfq.getId() : "/supplier/orders?orderId=" + order.getId(),
                "QUOTE",
                quote.getId(),
                true,
                rfqMeta(rfq, "supplier", metadata));
    }

    @Override
    public void notifySupplierComplaintCreated(OrderEntity order, Long complaintId, String buyerName) {
        if (order == null) return;
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.COMPLAINT_CREATED_FOR_SUPPLIER,
                "Buyer đã tạo khiếu nại",
                firstText(buyerName, "Buyer") + " đã tạo khiếu nại cho đơn " + orderCode(order.getId()) + ". Vui lòng kiểm tra và phản hồi.",
                "COMPLAINT",
                "/supplier/complaints?complaintId=" + complaintId + "&orderId=" + order.getId(),
                "COMPLAINT",
                complaintId,
                true,
                orderMeta(order, "supplier", Map.of("complaintId", complaintId, "buyerName", firstText(buyerName, "Buyer"))));
    }

    @Override
    public void notifySupplierShipmentIncidentCreated(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String buyerName) {
        if (order == null || shipment == null || incident == null) return;
        String shipmentCode = "SH-" + shipment.getId();
        String incidentType = firstText(incident.getIncidentType(), "DELIVERY_ISSUE");
        String actionUrl = "/supplier/delivery?shipmentId=" + shipmentCode + "&incident=true";
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("orderId", order.getId());
        metadata.put("shipmentId", shipmentCode);
        metadata.put("rawShipmentId", shipment.getId());
        metadata.put("trackingCode", firstText(shipment.getTrackingCode(), shipmentCode));
        metadata.put("incidentId", incident.getId());
        metadata.put("buyerName", firstText(buyerName, "Buyer"));
        metadata.put("incidentType", incidentType);
        metadata.put("issueSummary", firstText(incident.getDescription(), "Sự cố giao hàng cần xử lý"));
        metadata.put("targetModal", "incident");
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.SHIPMENT_INCIDENT,
                firstText(buyerName, "Buyer") + " báo sự cố shipment " + shipmentCode,
                "Shipment " + shipmentCode + " cần nhà cung cấp phản hồi sự cố giao hàng.",
                "DELIVERY",
                actionUrl,
                "SHIPMENT_INCIDENT",
                incident.getId(),
                true,
                orderMeta(order, "supplier", metadata));
    }

    @Override
    public void notifyBuyerShipmentIncidentSupplierResponded(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String supplierName) {
        if (order == null || shipment == null || incident == null) return;
        String shipmentCode = "SH-" + shipment.getId();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("orderId", order.getId());
        metadata.put("shipmentId", shipment.getId());
        metadata.put("shipmentCode", shipmentCode);
        metadata.put("incidentId", incident.getId());
        metadata.put("supplierName", firstText(supplierName, "Nhà cung cấp"));
        metadata.put("issueSummary", firstText(incident.getProposedResolution(), incident.getSupplierResponse(), "Nhà cung cấp đã phản hồi sự cố"));
        metadata.put("targetModal", "incident");
        notifyCompanyOwner(
                order.getBuyerCompanyId(),
                NotificationTypeEnum.DELIVERY_DISPUTE,
                "Nhà cung cấp đã phản hồi sự cố " + shipmentCode,
                firstText(supplierName, "Nhà cung cấp") + " đã gửi phương án xử lý. Vui lòng xác nhận để hoàn tất tranh chấp.",
                "DELIVERY",
                "/buyer/delivery?shipmentId=" + shipment.getId() + "&incident=true&incidentId=" + incident.getId(),
                "SHIPMENT_INCIDENT",
                incident.getId(),
                true,
                orderMeta(order, "buyer", metadata));
    }

    @Override
    public void notifySupplierShipmentIncidentBuyerAction(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String buyerName, String action) {
        if (order == null || shipment == null || incident == null) return;
        String shipmentCode = "SH-" + shipment.getId();
        String normalizedAction = firstText(action, "BUYER_ACTION").toUpperCase(Locale.ROOT);
        String title = switch (normalizedAction) {
            case "ACCEPT_RESOLUTION" -> "Buyer đã đồng ý phương án " + shipmentCode;
            case "REJECT_RESOLUTION" -> "Buyer chưa đồng ý phương án " + shipmentCode;
            case "REQUEST_CONTINUE" -> "Buyer yêu cầu xử lý tiếp " + shipmentCode;
            default -> "Buyer đã phản hồi sự cố " + shipmentCode;
        };
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("orderId", order.getId());
        metadata.put("shipmentId", shipmentCode);
        metadata.put("rawShipmentId", shipment.getId());
        metadata.put("incidentId", incident.getId());
        metadata.put("buyerName", firstText(buyerName, "Buyer"));
        metadata.put("buyerAction", normalizedAction);
        metadata.put("issueSummary", firstText(incident.getUpdateNote(), incident.getDescription(), "Buyer đã phản hồi phương án xử lý"));
        metadata.put("targetModal", "incident");
        notifyCompanyOwner(
                order.getSupplierCompanyId(),
                NotificationTypeEnum.BUYER_COMPLAINT,
                title,
                firstText(buyerName, "Buyer") + " đã phản hồi phương án xử lý sự cố. Vui lòng kiểm tra trung tâm tranh chấp.",
                "DELIVERY",
                "/supplier/delivery?shipmentId=" + shipmentCode + "&incident=true&incidentId=" + incident.getId(),
                "SHIPMENT_INCIDENT",
                incident.getId(),
                true,
                orderMeta(order, "supplier", metadata));
    }

    private NotificationEntity save(UserEntity owner, Long companyId, NotificationTypeEnum type, String title, String body, String module,
            String actionUrl, String entityType, Long entityId, boolean actionRequired, Map<String, Object> metadata) {
        Map<String, Object> fullMetadata = new LinkedHashMap<>();
        if (metadata != null) fullMetadata.putAll(metadata);
        fullMetadata.put("module", module);
        fullMetadata.put("actionUrl", actionUrl);
        fullMetadata.put("route", actionUrl);
        fullMetadata.put("entityType", entityType);
        fullMetadata.put("entityId", entityId);
        fullMetadata.put("actionRequired", actionRequired);
        fullMetadata.put("type", type.name());

        NotificationEntity notification = notificationRepository.save(NotificationEntity.builder()
                .userId(owner.getId())
                .companyId(companyId)
                .type(type)
                .title(title)
                .body(body)
                .metadata(toJson(fullMetadata))
                .refTable(entityType == null ? null : entityType.toLowerCase(Locale.ROOT))
                .refId(entityId)
                .isRead(Boolean.FALSE)
                .createdAt(LocalDateTime.now())
                .build());
        log.debug("Notification saved id={} type={} companyId={} userId={} module={} entityType={} entityId={}",
                notification.getId(), type, companyId, owner.getId(), module, entityType, entityId);
        return notification;
    }

    @Override
    public void pushRealtime(NotificationEntity notification) {
        if (notification == null) return;
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendRealtimeNow(notification);
                }
            });
            log.debug("Websocket message scheduled after commit notificationId={} companyId={} userId={}",
                    notification.getId(), notification.getCompanyId(), notification.getUserId());
            return;
        }
        sendRealtimeNow(notification);
    }

    private void sendRealtimeNow(NotificationEntity notification) {
        Map<String, Object> metadata = parseMetadata(notification.getMetadata());
        String module = stringValue(metadata.get("module"), inferModule(notification));
        String actionUrl = stringValue(metadata.get("actionUrl"), stringValue(metadata.get("route"), null));
        String entityType = stringValue(metadata.get("entityType"), notification.getRefTable());
        Long entityId = numberValue(metadata.get("entityId"), notification.getRefId());
        boolean actionRequired = booleanValue(metadata.get("actionRequired"));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", notification.getId());
        payload.put("module", module);
        payload.put("type", notification.getType() == null ? null : notification.getType().name());
        payload.put("title", notification.getTitle());
        payload.put("body", notification.getBody());
        payload.put("metadata", notification.getMetadata());
        payload.put("actionUrl", actionUrl);
        payload.put("entityType", entityType);
        payload.put("entityId", entityId);
        payload.put("actionRequired", actionRequired);
        payload.put("isRead", notification.getIsRead());
        payload.put("createdAt", notification.getCreatedAt());
        String companyDestination = "/topic/notifications.company." + notification.getCompanyId();
        String userDestination = "/topic/notifications.user." + notification.getUserId();
        messagingTemplate.convertAndSend(companyDestination, payload);
        messagingTemplate.convertAndSend(userDestination, payload);
        log.debug("Websocket message sent notificationId={} companyDestination={} userDestination={} module={} type={}",
                notification.getId(), companyDestination, userDestination, module, notification.getType());
    }

    private Map<String, Object> parseMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(metadata, new com.fasterxml.jackson.core.type.TypeReference<>() {
            });
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private Set<Long> eligibleSupplierIds(RfqEntity rfq) {
        if (rfq.getType() == RfqTypeEnum.DIRECT && rfq.getSupplierCompanyId() != null) {
            return Set.of(rfq.getSupplierCompanyId());
        }
        String province = normalize(rfq.getProvince());
        String productName = normalize(firstText(rfq.getProductName(), rfq.getTitle()));
        Set<Long> supplierIds = productRepository.findAll().stream()
                .filter(product -> !Objects.equals(product.getSupplierCompanyId(), rfq.getBuyerCompanyId()))
                .filter(product -> productMatchesRfqNotification(product, rfq, province, productName))
                .map(ProductEntity::getSupplierCompanyId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (province != null) {
            companyRepository.findAll().stream()
                    .filter(company -> CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType()))
                    .filter(company -> !Objects.equals(company.getId(), rfq.getBuyerCompanyId()))
                    .filter(company -> province.equals(normalize(company.getProvince())))
                    .map(CompanyEntity::getId)
                    .filter(Objects::nonNull)
                    .forEach(supplierIds::add);
        }

        return supplierIds;
    }

    private boolean productMatchesRfqNotification(ProductEntity product, RfqEntity rfq, String province, String productName) {
        if (product == null || rfq == null) return false;
        if (rfq.getProductId() != null && Objects.equals(product.getId(), rfq.getProductId())) return true;
        if (rfq.getCategoryId() != null && Objects.equals(product.getCategoryId(), rfq.getCategoryId())) return true;
        String supplierProductName = normalize(product.getName());
        if (productName != null && supplierProductName != null
                && (supplierProductName.contains(productName) || productName.contains(supplierProductName))) {
            return true;
        }
        return province != null && province.equals(normalize(product.getOriginProvince()));
    }

    private Map<String, Object> orderMeta(OrderEntity order, String role, Map<String, Object> extra) {
        Map<String, Object> metadata = baseMeta(role);
        metadata.put("orderId", order.getId());
        metadata.put("orderCode", orderCode(order.getId()));
        metadata.put("buyerCompanyId", order.getBuyerCompanyId());
        metadata.put("supplierCompanyId", order.getSupplierCompanyId());
        metadata.putAll(extra);
        return metadata;
    }

    private Map<String, Object> invoiceMeta(OrderEntity order, InvoiceEntity invoice, String role, Map<String, Object> extra) {
        Map<String, Object> metadata = orderMeta(order, role, extra);
        metadata.put("invoiceId", invoice.getId());
        metadata.put("invoiceCode", firstText(invoice.getInvoiceNumber(), "INV-" + invoice.getId()));
        return metadata;
    }

    private Map<String, Object> rfqMeta(RfqEntity rfq, String role, Map<String, Object> extra) {
        Map<String, Object> metadata = baseMeta(role);
        metadata.put("rfqId", rfq.getId());
        metadata.put("rfqCode", "RFQ-" + rfq.getId());
        metadata.put("buyerCompanyId", rfq.getBuyerCompanyId());
        metadata.putAll(extra);
        return metadata;
    }

    private Map<String, Object> baseMeta(String role) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("role", role);
        return metadata;
    }

    private String toJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private String orderCode(Long id) {
        return "ORD-" + id;
    }

    private String money(BigDecimal value) {
        return NumberFormat.getNumberInstance(new Locale("vi", "VN")).format(nullToZero(value)) + "đ";
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String firstText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String firstText(String value, String second, String... fallbacks) {
        String cleaned = firstText(value, null);
        if (cleaned != null) return cleaned;
        cleaned = firstText(second, null);
        if (cleaned != null) return cleaned;
        if (fallbacks == null) return null;
        for (String fallback : fallbacks) {
            cleaned = firstText(fallback, null);
            if (cleaned != null) return cleaned;
        }
        return null;
    }

    private String stringValue(Object value, String fallback) {
        return value instanceof String text && !text.isBlank() ? text : fallback;
    }

    private Long numberValue(Object value, Long fallback) {
        if (value instanceof Number number) return number.longValue();
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private boolean booleanValue(Object value) {
        return value instanceof Boolean bool && bool;
    }

    private String inferModule(NotificationEntity notification) {
        if (notification.getType() == null) return "SYSTEM";
        String type = notification.getType().name();
        if (type.startsWith("ORDER_")) return "ORDER";
        if (type.startsWith("PAYMENT_")) return "PAYMENT";
        if (type.startsWith("DELIVERY_")) return "DELIVERY";
        if (type.startsWith("RFQ_")) return "RFQ";
        if (type.startsWith("COMPLAINT_")) return "COMPLAINT";
        if (type.startsWith("DEBT_")) return "DEBT";
        return "SYSTEM";
    }

    private Long id(InvoiceEntity invoice) {
        return invoice == null ? null : invoice.getId();
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }
}
