package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CreateSupplierShipmentDto;
import com.agribridge.backend.dto.SupplierOrderDetailDto;
import com.agribridge.backend.dto.SupplierOrderDto;
import com.agribridge.backend.dto.SupplierShipmentIncidentActionDto;
import com.agribridge.backend.dto.UpdateSupplierOrderStatusDto;
import com.agribridge.backend.dto.UpdateSupplierShipmentStatusDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentIncidentRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.GhnShippingService;
import com.agribridge.backend.service.NotificationCenterService;
import com.agribridge.backend.service.ShipmentStatusTransitionService;
import com.agribridge.backend.service.SupplierOrderService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierOrderServiceImpl implements SupplierOrderService {

    private static final String SENDER_ADDRESS_SOURCE_SUPPLIER = "SUPPLIER_ADDRESS";
    private static final String SHIPPING_FEE_SOURCE_QUOTE = "SUPPLIER_TO_BUYER_QUOTE";

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CompanyRepository companyRepository;
    private final BranchRepository branchRepository;
    private final BatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final ShipmentIncidentRepository shipmentIncidentRepository;
    private final CurrentUserService currentUserService;
    private final GhnShippingService ghnShippingService;
    private final NotificationCenterService notificationCenterService;
    private final ShipmentStatusTransitionService shipmentStatusTransitionService;

    @Override
    @Transactional(readOnly = true)
    public List<SupplierOrderDto> getSupplierOrders(Long supplierCompanyId) {
        if (supplierCompanyId == null) {
            return List.of();
        }

        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(supplierCompanyId);
        OrderLookup lookup = buildLookup(orders);
        return orders.stream().map(order -> toOrderDto(order, lookup)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierOrderDetailDto getSupplierOrderDetail(Long supplierCompanyId, Long orderId) {
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        OrderLookup lookup = buildLookup(List.of(order));
        SupplierOrderDto row = toOrderDto(order, lookup);
        CompanyEntity buyer = lookup.buyerById().get(order.getBuyerCompanyId());
        BranchEntity branch = lookup.branchById().get(order.getBranchId());
        ShipmentEntity shipment = lookup.shipmentByOrderId().get(order.getId());
        List<SupplierOrderDetailDto.ShipmentEventDto> events = shipment == null ? List.of()
                : shipmentEventRepository.findByShipmentIdOrderByEventTimeAsc(shipment.getId()).stream()
                        .map(event -> new SupplierOrderDetailDto.ShipmentEventDto(
                                event.getId(),
                                safeText(event.getStatus()),
                                safeText(event.getDescription()),
                                safeText(event.getLocation()),
                                formatDateTime(event.getEventTime())))
                        .toList();

        return new SupplierOrderDetailDto(
                row.id(),
                row.rawId(),
                buyer == null ? "Khach hang" : safeText(buyer.getName()),
                buyer == null ? "" : safeText(buyer.getPhone()),
                buyer == null ? "" : safeText(buyer.getEmail()),
                branch == null ? "Chi nhanh" : safeText(branch.getName()),
                safeText(order.getDeliveryAddress()),
                safeText(order.getDeliveryProvince()),
                safeText(order.getNote()),
                row.value(),
                row.status(),
                row.statusCode(),
                row.shipment(),
                row.shipmentStatus(),
                row.shipmentStatusCode(),
                row.availableActions(),
                events,
                row.orderDate(),
                lookup.itemsByOrderId().getOrDefault(order.getId(), List.of()).stream()
                        .map(item -> toDetailItem(item, lookup.batchById().get(item.getBatchId()),
                                lookup.productById()))
                        .toList());
    }

    @Override
    @Transactional
    public SupplierOrderDto updateSupplierOrderStatus(
            Long supplierCompanyId,
            Long orderId,
            UpdateSupplierOrderStatusDto request) {
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        OrderStatusEnum nextStatus = parseOrderStatus(request.status());

        if (nextStatus == OrderStatusEnum.CONFIRMED) {
            confirmOrder(order);
        } else if (nextStatus == OrderStatusEnum.CANCELLED) {
            cancelOrder(order);
        } else {
            throw new IllegalArgumentException("Supplier cannot set order status to " + nextStatus);
        }

        OrderStatusEnum appliedStatus = order.getStatus();
        OrderEntity saved = orderRepository.save(order);
        String supplierName = companyRepository.findById(saved.getSupplierCompanyId()).map(CompanyEntity::getName).orElse("Nhà cung cấp");
        if (appliedStatus == OrderStatusEnum.CONFIRMED) {
            notificationCenterService.notifyBuyerOrderConfirmed(saved, supplierName);
        } else if (appliedStatus == OrderStatusEnum.CANCELLED) {
            notificationCenterService.notifyBuyerOrderCancelled(saved, supplierName);
        }
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    @Override
    @Transactional
    public SupplierOrderDto createShipment(Long supplierCompanyId, Long orderId, CreateSupplierShipmentDto request) {
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        if (!OrderStatusEnum.CONFIRMED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only confirmed orders can create shipment");
        }
        ShipmentEntity existing = findActiveShipment(orderId);
        if (existing != null) {
            throw new IllegalArgumentException("Order already has an active shipment");
        }

        LocalDateTime now = LocalDateTime.now();
        ShipmentEntity shipment = ShipmentEntity.builder()
                .orderId(orderId)
                .carrierName(normalizeText(request.carrierName()))
                .shippingMethod(normalizeText(request.shippingMethod()))
                .driverName(normalizeText(request.driverName()))
                .driverPhone(normalizeText(request.driverPhone()))
                .vehicleInfo(normalizeText(request.vehicleInfo()))
                .shippingFee(request.shippingFee() == null ? BigDecimal.ZERO : request.shippingFee())
                .trackingCode(normalizeText(request.trackingCode()) == null ? generateTrackingCode(orderId)
                        : normalizeText(request.trackingCode()))
                .incidentNote(normalizeText(request.note()))
                .status(ShipmentStatusEnum.WAITING_PICKUP)
                .autoProgressEnabled(Boolean.TRUE)
                .demoTrackingEnabled(Boolean.TRUE)
                .lastStatusChangedAt(now)
                .progress(20)
                .feeConfirmed(Boolean.FALSE)
                .createdAt(now)
                .updatedAt(now)
                .build();
        ShipmentEntity saved = shipmentRepository.save(shipment);
        saveShipmentEvent(saved, "Đã tạo vận đơn");
        saveShipmentEvent(saved, "Chờ lấy hàng");

        return toOrderDto(order, buildLookup(List.of(order)));
    }

    @Override
    @Transactional
    public SupplierOrderDto updateShipmentStatus(Long supplierCompanyId, Long orderId,
            UpdateSupplierShipmentStatusDto request) {
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        if (!OrderStatusEnum.CONFIRMED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only confirmed orders can update shipment");
        }
        ShipmentEntity shipment = findActiveShipment(orderId);
        if (shipment == null) {
            throw new IllegalArgumentException("Shipment not found");
        }

        ShipmentStatusEnum next = parseShipmentStatus(request.status());
        ShipmentStatusEnum current = normalizeShipmentStatus(shipment.getStatus());
        validateShipmentTransition(current, next);
        shipment.setStatus(next);
        if (next == ShipmentStatusEnum.SHIPPED && shipment.getShippedAt() == null) {
            shipment.setShippedAt(LocalDateTime.now());
        }
        shipmentRepository.save(shipment);
        saveShipmentEvent(shipment, shipmentEventDescription(next));
        if (next == ShipmentStatusEnum.SHIPPED || next == ShipmentStatusEnum.IN_TRANSIT || next == ShipmentStatusEnum.SHIPPING) {
            notificationCenterService.notifyBuyerDeliveryInTransit(order);
        } else if (next == ShipmentStatusEnum.WAITING_CONFIRMATION) {
            notificationCenterService.notifyBuyerDeliveryWaitingConfirmation(order);
        } else if (next == ShipmentStatusEnum.FAILED || next == ShipmentStatusEnum.FAILED_DELIVERY) {
            notificationCenterService.notifyDeliveryFailed(order);
        }

        return toOrderDto(order, buildLookup(List.of(order)));
    }

    @Override
    @Transactional
    public SupplierOrderDto confirmDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        if (!OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM.equals(order.getStatus())
                && !OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM.equals(order.getStatus())
                && !OrderStatusEnum.SUPPLIER_CONFIRMED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only paid/deposit-paid orders can be confirmed");
        }
        order.setStatus(OrderStatusEnum.SUPPLIER_CONFIRMED);
        order.setUpdatedAt(LocalDateTime.now());
        OrderEntity saved = orderRepository.save(order);
        String supplierName = companyRepository.findById(saved.getSupplierCompanyId()).map(CompanyEntity::getName).orElse("Nhà cung cấp");
        notificationCenterService.notifyBuyerOrderConfirmed(saved, supplierName);
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    @Override
    @Transactional
    public SupplierOrderDto prepareDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        if (!OrderStatusEnum.SUPPLIER_CONFIRMED.equals(order.getStatus())
                && !OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM.equals(order.getStatus())
                && !OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM.equals(order.getStatus())) {
            throw new IllegalArgumentException("Order must be paid");
        }
        order.setStatus(OrderStatusEnum.PREPARING);
        order.setUpdatedAt(LocalDateTime.now());
        OrderEntity saved = orderRepository.save(order);
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    @Override
    @Transactional
    public SupplierOrderDto readyToShipDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        requireOrderStatus(order, OrderStatusEnum.PREPARING);
        LocalDateTime now = LocalDateTime.now();
        ShipmentEntity shipment = findActiveShipment(orderId);
        if (shipment == null) {
            shipment = shipmentRepository.save(ShipmentEntity.builder()
                    .orderId(orderId)
                    .carrierName("MANUAL")
                    .providerCode("MANUAL")
                    .providerName("MANUAL")
                    .serviceName("Manual delivery")
                    .shippingMethod("MANUAL")
                    .receiverName(order.getDeliveryName())
                    .receiverPhone(order.getDeliveryPhone())
                    .receiverProvince(order.getDeliveryProvince())
                    .receiverWard(order.getDeliveryWard())
                    .receiverAddress(order.getDeliveryAddress())
                    .trackingCode("AGRI-MANUAL-" + orderId)
                    .quoteStatus("CREATED")
                    .estimatedDeliveryAt(order.getExpectedDeliveryDate())
                    .expectedDeliveryDate(order.getExpectedDeliveryDate())
                    .shippingFee(safeAmount(order.getShippingFee()))
                    .feeConfirmed(Boolean.TRUE)
                    .status(ShipmentStatusEnum.WAITING_PICKUP)
                    .autoProgressEnabled(Boolean.TRUE)
                    .demoTrackingEnabled(Boolean.TRUE)
                    .lastStatusChangedAt(now)
                    .progress(20)
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
            saveShipmentEvent(shipment, "Đã tạo vận đơn MANUAL demo");
            saveShipmentEvent(shipment, "Chờ lấy hàng");
        }

        if ("GHN".equals(shipment.getProviderCode()) && shipment.getGhnOrderCode() == null) {
            try {
                var ghnResponse = ghnShippingService.createGhnShippingOrder(order, shipment);
                if (ghnResponse != null && ghnResponse.data() != null) {
                    BigDecimal ghnTotalFee = safeAmount(ghnResponse.data().total_fee());
                    BigDecimal quotedFee = safeAmount(order.getShippingFee());
                    shipment.setGhnOrderCode(ghnResponse.data().order_code());
                    shipment.setTrackingCode(ghnResponse.data().order_code());
                    shipment.setGhnSortCode(ghnResponse.data().sort_code());
                    shipment.setGhnTransType(ghnResponse.data().trans_type());
                    shipment.setEstimatedDeliveryTime(ghnResponse.data().expected_delivery_time());
                    shipment.setQuotedShippingFee(quotedFee);
                    shipment.setGhnCreateFee(ghnTotalFee);
                    shipment.setSenderAddressSource(SENDER_ADDRESS_SOURCE_SUPPLIER);
                    shipment.setShippingFeeSource(SHIPPING_FEE_SOURCE_QUOTE);
                    shipment.setShippingFee(quotedFee);
                    shipment.setFeeConfirmed(quotedFee.compareTo(BigDecimal.ZERO) > 0);
                    shipment.setStatus(ShipmentStatusEnum.WAITING_PICKUP);
                    shipment.setAutoProgressEnabled(Boolean.TRUE);
                    shipment.setDemoTrackingEnabled(Boolean.TRUE);
                    shipment.setLastStatusChangedAt(now);
                    shipment.setProgress(20);
                    shipment.setUpdatedAt(now);
                    shipment = shipmentRepository.save(shipment);
                    // Keep supplier->buyer quoted fee even if GHN responds with a different fee
                    // (shop default).
                    if (ghnTotalFee.compareTo(BigDecimal.ZERO) > 0 && quotedFee.compareTo(BigDecimal.ZERO) > 0
                            && ghnTotalFee.compareTo(quotedFee) != 0) {
                        log.warn(
                                "GHN create fee differs from quoted fee; keeping quoted fee. quotedFee={}, ghnFee={}",
                                quotedFee,
                                ghnTotalFee);
                    }
                    saveShipmentEvent(shipment, "Đã tạo vận đơn GHN: " + ghnResponse.data().order_code());
                    saveShipmentEvent(shipment, "Chờ lấy hàng");
                }
            } catch (Exception ex) {
                log.warn("GHN Create Order failed during demo flow, keeping shipment as is: {}", ex.getMessage());
                saveShipmentEvent(shipment, "Không thể tạo vận đơn GHN tự động: " + ex.getMessage());
            }
        }
        order.setStatus(OrderStatusEnum.READY_TO_SHIP);
        order.setUpdatedAt(now);
        OrderEntity saved = orderRepository.save(order);
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    @Override
    @Transactional
    public SupplierOrderDto startShippingDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        ShipmentEntity shipment = findActiveShipment(orderId);
        if (shipment == null) {
            throw new IllegalArgumentException("Shipment not found");
        }
        LocalDateTime now = LocalDateTime.now();
        ShipmentStatusEnum currentShipmentStatus = normalizeShipmentStatus(shipment.getStatus());
        if (!OrderStatusEnum.READY_TO_SHIP.equals(order.getStatus())
                && !OrderStatusEnum.SHIPPING.equals(order.getStatus())
                && !isStartedShippingStatus(currentShipmentStatus)) {
            throw new IllegalArgumentException("Order must be " + OrderStatusEnum.READY_TO_SHIP);
        }
        shipment.setStatus(ShipmentStatusEnum.WAITING_PICKUP);
        shipment.setAutoProgressEnabled(Boolean.TRUE);
        shipment.setDemoTrackingEnabled(Boolean.TRUE);
        shipment.setLastStatusChangedAt(now);
        shipment.setProgress(20);
        shipment.setUpdatedAt(now);
        shipmentRepository.save(shipment);
        saveShipmentEvent(shipment, "Chờ lấy hàng");
        order.setStatus(OrderStatusEnum.SHIPPING);
        order.setUpdatedAt(now);
        OrderEntity saved = orderRepository.save(order);
        notificationCenterService.notifyBuyerDeliveryInTransit(saved);
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    private boolean isStartedShippingStatus(ShipmentStatusEnum status) {
        return status == ShipmentStatusEnum.WAITING_PICKUP
                || status == ShipmentStatusEnum.PICKED_UP
                || status == ShipmentStatusEnum.SHIPPED
                || status == ShipmentStatusEnum.IN_TRANSIT
                || status == ShipmentStatusEnum.OUT_FOR_DELIVERY
                || status == ShipmentStatusEnum.SHIPPING;
    }

    @Override
    @Transactional
    public SupplierOrderDto markDeliveredDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        requireOrderStatus(order, OrderStatusEnum.SHIPPING);
        ShipmentEntity shipment = findActiveShipment(orderId);
        if (shipment == null) {
            throw new IllegalArgumentException("Shipment not found");
        }
        LocalDateTime now = LocalDateTime.now();
        shipmentStatusTransitionService.transition(
                shipment,
                ShipmentStatusEnum.WAITING_CONFIRMATION,
                "Đã giao tới nơi, chờ người mua xác nhận");
        boolean deposit = "DEPOSIT_50".equals(order.getPaymentOption());
        order.setStatus(deposit ? OrderStatusEnum.WAITING_FINAL_PAYMENT : OrderStatusEnum.WAITING_BUYER_CONFIRM);
        if (deposit) {
            order.setPaymentStatus("WAITING_REMAINING_PAYMENT");
        }
        order.setUpdatedAt(now);
        OrderEntity saved = orderRepository.save(order);
        notificationCenterService.notifyBuyerDeliveryWaitingConfirmation(saved);
        return toOrderDto(saved, buildLookup(List.of(saved)));
    }

    @Override
    @Transactional
    public SupplierOrderDto syncGhnDemoOrder(Long orderId) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        OrderEntity order = getSupplierOrder(supplierCompanyId, orderId);
        ShipmentEntity shipment = findActiveShipment(orderId);
        if (shipment == null || !"GHN".equals(shipment.getProviderCode()) || shipment.getGhnOrderCode() == null) {
            throw new IllegalArgumentException("Đơn hàng không có vận đơn GHN hợp lệ để đồng bộ");
        }

        try {
            CompanyEntity supplier = companyRepository.findById(order.getSupplierCompanyId())
                    .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
            String shopIdUsed = supplier.getGhnShopId() != null ? String.valueOf(supplier.getGhnShopId()) : null;
            if (shopIdUsed == null) {
                throw new IllegalStateException("Nhà cung cấp chưa có cửa hàng GHN hợp lệ để đồng bộ.");
            }
            var detailResponse = ghnShippingService.syncGhnOrderStatus(shipment.getGhnOrderCode(), shopIdUsed);
            if (detailResponse != null && detailResponse.data() != null) {
                String ghnStatus = detailResponse.data().status();
                ShipmentStatusEnum newStatus = ghnShippingService.mapGhnStatusToShipmentStatus(ghnStatus);
                ShipmentStatusEnum currentStatus = normalizeShipmentStatus(shipment.getStatus());

                if (currentStatus != newStatus) {
                    shipment = shipmentStatusTransitionService.transition(
                            shipment,
                            newStatus,
                            "Đồng bộ GHN: Trạng thái mới là " + ghnStatus);

                    // Auto update order status based on shipment
                    if (newStatus == ShipmentStatusEnum.PICKED_UP
                            || newStatus == ShipmentStatusEnum.SHIPPED
                            || newStatus == ShipmentStatusEnum.IN_TRANSIT
                            || newStatus == ShipmentStatusEnum.OUT_FOR_DELIVERY
                            || newStatus == ShipmentStatusEnum.SHIPPING) {
                        if (order.getStatus() == OrderStatusEnum.READY_TO_SHIP
                                || order.getStatus() == OrderStatusEnum.PREPARING) {
                            order.setStatus(OrderStatusEnum.SHIPPING);
                            orderRepository.save(order);
                        }
                    } else if (newStatus == ShipmentStatusEnum.WAITING_CONFIRMATION) {
                        if (order.getStatus() == OrderStatusEnum.SHIPPING) {
                            boolean deposit = "DEPOSIT_50".equals(order.getPaymentOption());
                            order.setStatus(deposit ? OrderStatusEnum.WAITING_FINAL_PAYMENT
                                    : OrderStatusEnum.WAITING_BUYER_CONFIRM);
                            if (deposit) {
                                order.setPaymentStatus("WAITING_REMAINING_PAYMENT");
                            }
                            orderRepository.save(order);
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to sync GHN status for order {}: {}", orderId, ex.getMessage());
            throw new RuntimeException("Không thể đồng bộ GHN: " + ex.getMessage());
        }

        return toOrderDto(order, buildLookup(List.of(order)));
    }

    @Override
    @Transactional
    public void updateShipmentIncident(Long shipmentId, Long incidentId, SupplierShipmentIncidentActionDto request) {
        Long supplierCompanyId = currentUserService.requireCurrentSupplierCompanyId();
        ShipmentEntity shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));
        OrderEntity order = getSupplierOrder(supplierCompanyId, shipment.getOrderId());
        ShipmentIncidentEntity incident = shipmentIncidentRepository.findById(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("Incident not found"));
        if (!shipment.getId().equals(incident.getShipmentId())) {
            throw new IllegalArgumentException("Incident not found");
        }

        LocalDateTime now = LocalDateTime.now();
        String action = normalizeText(request == null ? null : request.action());
        String note = normalizeText(request == null ? null : request.note());
        String resolution = normalizeText(request == null ? null : request.proposedResolution());
        String resolutionType = normalizeText(request == null ? null : request.resolutionType());
        BigDecimal compensationAmount = request == null ? null : request.compensationAmount();
        if (resolutionType == null && action != null) {
            String normalizedAction = action.toUpperCase(Locale.ROOT);
            if (normalizedAction.contains("REFUND")) {
                resolutionType = "REFUND";
            } else if (normalizedAction.contains("REPLACEMENT")) {
                resolutionType = "REPLACEMENT";
            } else if (normalizedAction.contains("ACCEPT")) {
                resolutionType = "ACCEPT_COMPLAINT";
            } else if (normalizedAction.contains("REJECT")) {
                resolutionType = "REJECT_COMPLAINT";
            }
        }
        String nextStatus = incidentNextStatus(action);
        String eventDescription = incidentEventDescription(action, nextStatus, resolutionType, note, compensationAmount);

        if (note != null) {
            String existing = normalizeText(incident.getSupplierResponse());
            incident.setSupplierResponse(existing == null ? note : existing + "\n---\n" + note);
        }
        if (resolution != null) {
            incident.setProposedResolution(withCompensationAmount(resolution, compensationAmount));
        } else if (compensationAmount != null) {
            incident.setProposedResolution(withCompensationAmount("Đề xuất bồi hoàn", compensationAmount));
        }
        if (resolutionType != null) {
            incident.setResolutionType(resolutionType.toUpperCase(Locale.ROOT));
        }
        List<String> mergedEvidence = new java.util.ArrayList<>(parseEvidenceUrls(incident.getSupplierEvidenceUrls()));
        if (request != null && request.evidenceUrls() != null) {
            for (String url : request.evidenceUrls()) {
                String cleaned = normalizeText(url);
                if (cleaned != null && !mergedEvidence.contains(cleaned)) {
                    mergedEvidence.add(cleaned);
                }
            }
        }
        incident.setSupplierEvidenceUrls(mergedEvidence.isEmpty() ? null : String.join(",", mergedEvidence));
        incident.setStatus(nextStatus);
        incident.setUpdatedAt(now);
        if ("WAITING_BUYER_CONFIRMATION".equals(nextStatus)) {
            incident.setBuyerActionRequiredAt(now);
        } else {
            incident.setBuyerActionRequiredAt(null);
        }
        shipmentIncidentRepository.save(incident);

        shipment.setStatus(ShipmentStatusEnum.INCIDENT);
        shipment.setIncidentNote(firstNonBlank(resolution, note, incident.getDescription()));
        shipment.setUpdatedAt(now);
        shipmentRepository.save(shipment);
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status("DISPUTE_" + nextStatus)
                .description(eventDescription)
                .eventTime(now)
                .build());
        String supplierName = companyRepository.findById(order.getSupplierCompanyId()).map(CompanyEntity::getName).orElse("Nhà cung cấp");
        notificationCenterService.notifyBuyerShipmentIncidentSupplierResponded(order, shipment, incident, supplierName);
        log.info("Supplier updated shipment incident orderId={} shipmentId={} incidentId={} status={}",
                order.getId(), shipmentId, incidentId, nextStatus);
    }

    private void confirmOrder(OrderEntity order) {
        if (!OrderStatusEnum.PENDING.equals(order.getStatus())
                && !OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only pending orders can be confirmed");
        }
        // Block confirmation for unverified suppliers
        if (order.getSupplierCompanyId() != null) {
            companyRepository.findById(order.getSupplierCompanyId()).ifPresent(supplier -> {
                VerificationStatusEnum vs = supplier.getVerificationStatus();
                if (vs == VerificationStatusEnum.PENDING_REVIEW || vs == VerificationStatusEnum.PENDING
                        || vs == VerificationStatusEnum.DRAFT) {
                    throw new IllegalArgumentException(
                            "H\u1ed3 s\u01a1 c\u1ee7a b\u1ea1n \u0111ang ch\u1edd duy\u1ec7t. Kh\u00f4ng th\u1ec3 x\u00e1c nh\u1eadn \u0111\u01a1n h\u00e0ng khi ch\u01b0a \u0111\u01b0\u1ee3c x\u00e1c minh.");
                }
            });
        }
        List<OrderItemEntity> items = orderItemRepository.findByOrderIdOrderByIdAsc(order.getId());
        if (items.isEmpty()) {
            throw new IllegalArgumentException("Order has no items");
        }
        Map<Long, BatchEntity> batchById = loadBatches(items.stream().map(OrderItemEntity::getBatchId).toList());
        for (OrderItemEntity item : items) {
            BatchEntity batch = item.getBatchId() == null ? null : batchById.get(item.getBatchId());
            if (batch == null) {
                throw new IllegalArgumentException("Order item batch is invalid");
            }
            if (!BatchStatusEnum.AVAILABLE.equals(batch.getStatus())) {
                throw new IllegalArgumentException("Batch is not available");
            }
            if (batch.getQuantity() == null || item.getQuantity() == null
                    || batch.getQuantity().compareTo(item.getQuantity()) < 0) {
                throw new IllegalArgumentException("Batch quantity is not enough");
            }
        }
        order.setStatus(OrderStatusEnum.CONFIRMED);
    }

    private void requireOrderStatus(OrderEntity order, OrderStatusEnum expected) {
        if (!expected.equals(order.getStatus())) {
            throw new IllegalArgumentException("Order must be " + expected);
        }
    }

    private void cancelOrder(OrderEntity order) {
        if (OrderStatusEnum.DELIVERED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Delivered orders cannot be cancelled");
        }
        ShipmentEntity shipment = findActiveShipment(order.getId());
        ShipmentStatusEnum status = shipment == null ? null : normalizeShipmentStatus(shipment.getStatus());
        if (status == ShipmentStatusEnum.WAITING_PICKUP
                || status == ShipmentStatusEnum.PICKED_UP
                || status == ShipmentStatusEnum.SHIPPED
                || status == ShipmentStatusEnum.IN_TRANSIT
                || status == ShipmentStatusEnum.OUT_FOR_DELIVERY
                || status == ShipmentStatusEnum.WAITING_CONFIRMATION
                || status == ShipmentStatusEnum.DELIVERED) {
            throw new IllegalArgumentException("Cannot cancel order after shipment has started");
        }
        order.setStatus(OrderStatusEnum.CANCELLED);
        if (shipment != null && status == ShipmentStatusEnum.PENDING) {
            shipment.setStatus(ShipmentStatusEnum.CANCELLED);
            shipmentRepository.save(shipment);
            saveShipmentEvent(shipment, "Đã hủy giao hàng");
        }
    }

    private OrderEntity getSupplierOrder(Long supplierCompanyId, Long orderId) {
        if (supplierCompanyId == null || orderId == null) {
            throw new IllegalArgumentException("Supplier company and order are required");
        }
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!supplierCompanyId.equals(order.getSupplierCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this supplier");
        }
        return order;
    }

    private OrderLookup buildLookup(List<OrderEntity> orders) {
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).filter(Objects::nonNull).toList();
        List<OrderItemEntity> items = orderIds.isEmpty() ? List.of() : orderItemRepository.findByOrderIdIn(orderIds);
        Map<Long, List<OrderItemEntity>> itemsByOrderId = items.stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId, LinkedHashMap::new, Collectors.toList()));
        Map<Long, BatchEntity> batchById = loadBatches(items.stream().map(OrderItemEntity::getBatchId).toList());
        Map<Long, ProductEntity> productById = loadProducts(
                batchById.values().stream().map(BatchEntity::getProductId).toList());
        Map<Long, CompanyEntity> buyerById = companyRepository.findAllById(
                orders.stream().map(OrderEntity::getBuyerCompanyId).filter(Objects::nonNull).toList())
                .stream()
                .collect(Collectors.toMap(CompanyEntity::getId, value -> value, (left, right) -> left));
        Map<Long, BranchEntity> branchById = branchRepository.findByIdIn(
                orders.stream().map(OrderEntity::getBranchId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(BranchEntity::getId, value -> value, (left, right) -> left));
        Map<Long, ShipmentEntity> shipmentByOrderId = new LinkedHashMap<>();
        if (!orderIds.isEmpty()) {
            for (ShipmentEntity shipment : shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds)) {
                shipmentByOrderId.putIfAbsent(shipment.getOrderId(), shipment);
            }
        }
        return new OrderLookup(itemsByOrderId, batchById, productById, buyerById, branchById, shipmentByOrderId);
    }

    private Map<Long, BatchEntity> loadBatches(Collection<Long> batchIds) {
        Set<Long> ids = batchIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return batchRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(BatchEntity::getId, value -> value, (left, right) -> left));
    }

    private Map<Long, ProductEntity> loadProducts(Collection<Long> productIds) {
        Set<Long> ids = productIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return productRepository.findByIdIn(ids).stream()
                .collect(Collectors.toMap(ProductEntity::getId, value -> value, (left, right) -> left));
    }

    private SupplierOrderDto toOrderDto(OrderEntity order, OrderLookup lookup) {
        List<OrderItemEntity> rawItems = lookup.itemsByOrderId().getOrDefault(order.getId(), List.of());
        List<SupplierOrderDto.OrderItemSummaryDto> items = rawItems.stream()
                .map(item -> toOrderItemSummary(item, lookup.batchById().get(item.getBatchId()), lookup.productById()))
                .toList();
        ShipmentEntity shipment = lookup.shipmentByOrderId().get(order.getId());
        SupplierOrderDto.ShipmentSummaryDto shipmentSummary = toShipmentSummary(shipment);
        String quantity = rawItems.stream()
                .map(OrderItemEntity::getQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .stripTrailingZeros()
                .toPlainString();

        return new SupplierOrderDto(
                orderCode(order),
                order.getId(),
                lookup.buyerById().get(order.getBuyerCompanyId()) == null ? "Khach hang"
                        : safeText(lookup.buyerById().get(order.getBuyerCompanyId()).getName()),
                lookup.branchById().get(order.getBranchId()) == null ? "Chi nhanh"
                        : safeText(lookup.branchById().get(order.getBranchId()).getName()),
                summarizeProducts(items),
                items,
                quantity + (items.isEmpty() ? "kg" : items.get(0).unit()),
                formatMoney(order.getTotalAmount()),
                mapOrderStatus(order.getStatus()),
                statusCode(order.getStatus()),
                shipmentSummary,
                mapShipmentStatus(shipment == null ? null : shipment.getStatus()),
                shipment == null ? null : normalizeShipmentStatus(shipment.getStatus()).name(),
                availableActions(order, shipment),
                formatDate(order.getCreatedAt()));
    }

    private SupplierOrderDto.OrderItemSummaryDto toOrderItemSummary(
            OrderItemEntity item,
            BatchEntity batch,
            Map<Long, ProductEntity> productById) {
        ProductEntity product = batch == null ? null : productById.get(batch.getProductId());
        String unit = product == null ? "kg" : safeText(product.getUnit());
        return new SupplierOrderDto.OrderItemSummaryDto(
                item.getId(),
                item.getBatchId(),
                item.getBatchId() == null ? "Batch N/A" : "Batch #" + item.getBatchId(),
                product == null ? "N/A" : safeText(product.getName()),
                formatQuantity(item.getQuantity(), unit),
                unit,
                batch == null ? "N/A" : safeText(batch.getGrade()),
                batch == null ? "N/A" : safeText(batch.getSize()),
                batch == null ? "N/A" : formatMoney(batch.getPrice()),
                batch == null ? "N/A" : formatDate(batch.getHarvestDate()),
                batch == null ? "N/A" : formatDate(batch.getExpiryDate()));
    }

    private SupplierOrderDetailDto.ItemDto toDetailItem(
            OrderItemEntity item,
            BatchEntity batch,
            Map<Long, ProductEntity> productById) {
        ProductEntity product = batch == null ? null : productById.get(batch.getProductId());
        String unit = product == null ? "kg" : safeText(product.getUnit());
        BigDecimal lineTotal = safeAmount(item.getQuantity()).multiply(safeAmount(item.getPrice()));
        return new SupplierOrderDetailDto.ItemDto(
                item.getId(),
                item.getBatchId(),
                item.getBatchId() == null ? "Batch N/A" : "Batch #" + item.getBatchId(),
                product == null ? "N/A" : safeText(product.getName()),
                formatQuantity(item.getQuantity(), unit),
                unit,
                batch == null ? "N/A" : safeText(batch.getGrade()),
                batch == null ? "N/A" : safeText(batch.getSize()),
                batch == null ? "N/A" : formatDate(batch.getHarvestDate()),
                batch == null ? "N/A" : formatDate(batch.getExpiryDate()),
                formatMoney(item.getPrice()),
                formatMoney(lineTotal));
    }

    private SupplierOrderDto.ShipmentSummaryDto toShipmentSummary(ShipmentEntity shipment) {
        if (shipment == null) {
            return null;
        }
        ShipmentStatusEnum status = normalizeShipmentStatus(shipment.getStatus());
        return new SupplierOrderDto.ShipmentSummaryDto(
                shipment.getId(),
                mapShipmentStatus(status),
                status.name(),
                safeText(shipment.getTrackingCode()),
                safeText(shipment.getCarrierName()),
                safeText(shipment.getShippingMethod()),
                safeText(shipment.getDriverName()),
                safeText(shipment.getDriverPhone()),
                safeText(shipment.getVehicleInfo()),
                formatMoney(shipment.getShippingFee()),
                formatDateTime(shipment.getShippedAt()),
                formatDateTime(shipment.getDeliveredAt()));
    }

    private List<String> availableActions(OrderEntity order, ShipmentEntity shipment) {
        if (order == null || order.getStatus() == null) {
            return List.of("VIEW_DETAIL");
        }
        ShipmentStatusEnum shipmentStatus = shipment == null ? null : normalizeShipmentStatus(shipment.getStatus());
        return switch (order.getStatus()) {
            case PAID_WAITING_SUPPLIER_CONFIRM, DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM ->
                List.of("VIEW_DETAIL", "PREPARE_ORDER");
            case SUPPLIER_CONFIRMED -> List.of("VIEW_DETAIL", "PREPARE_ORDER");
            case PREPARING -> List.of("VIEW_DETAIL", "READY_TO_SHIP");
            case READY_TO_SHIP -> List.of("VIEW_DETAIL", "START_SHIPPING");
            case WAITING_FINAL_PAYMENT, WAITING_BUYER_CONFIRM, COMPLETED, DISPUTED, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED ->
                List.of("VIEW_DETAIL");
            case PENDING_PAYMENT, PENDING_DEPOSIT -> List.of("VIEW_DETAIL");
            case PENDING_SUPPLIER_CONFIRMATION -> List.of("VIEW_DETAIL", "CONFIRM_ORDER", "CANCEL_ORDER");
            case PENDING -> List.of("VIEW_DETAIL", "CONFIRM_ORDER", "CANCEL_ORDER");
            case CONFIRMED -> {
                if (shipment == null || shipmentStatus == ShipmentStatusEnum.CANCELLED
                        || shipmentStatus == ShipmentStatusEnum.FAILED) {
                    yield List.of("VIEW_DETAIL", "CREATE_SHIPMENT", "CANCEL_ORDER");
                }
                yield switch (shipmentStatus) {
                    case PENDING, PREPARING, WAITING_PICKUP, PICKED_UP, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY ->
                        List.of("VIEW_DETAIL");
                    case WAITING_CONFIRMATION -> List.of("VIEW_DETAIL");
                    case DELIVERED -> List.of("VIEW_DETAIL", "VIEW_SHIPMENT");
                    default -> List.of("VIEW_DETAIL");
                };
            }
            case DELIVERED -> List.of("VIEW_DETAIL", "VIEW_SHIPMENT");
            case CANCELLED -> List.of("VIEW_DETAIL");
            case SHIPPING -> List.of("VIEW_DETAIL");
        };
    }

    private ShipmentEntity findActiveShipment(Long orderId) {
        return shipmentRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .filter(shipment -> {
                    ShipmentStatusEnum status = normalizeShipmentStatus(shipment.getStatus());
                    return status != ShipmentStatusEnum.CANCELLED && status != ShipmentStatusEnum.FAILED;
                })
                .findFirst()
                .orElse(null);
    }

    private void validateShipmentTransition(ShipmentStatusEnum current, ShipmentStatusEnum next) {
        boolean allowed = switch (current) {
            case CREATED, PENDING, PREPARING, WAITING_PICKUP -> next == ShipmentStatusEnum.PICKED_UP;
            case PICKED_UP, SHIPPED -> next == ShipmentStatusEnum.IN_TRANSIT;
            case IN_TRANSIT -> next == ShipmentStatusEnum.OUT_FOR_DELIVERY;
            case OUT_FOR_DELIVERY -> next == ShipmentStatusEnum.WAITING_CONFIRMATION;
            default -> false;
        };
        if (!allowed) {
            throw new IllegalArgumentException("Cannot change shipment status from " + current + " to " + next);
        }
    }

    private void saveShipmentEvent(ShipmentEntity shipment, String description) {
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(normalizeShipmentStatus(shipment.getStatus()).name())
                .description(description)
                .eventTime(LocalDateTime.now())
                .build());
    }

    private String incidentNextStatus(String action) {
        String normalizedAction = action == null ? "RESPOND" : action.trim().toUpperCase(Locale.ROOT);
        return switch (normalizedAction) {
            case "OFFER_COMPENSATION", "ACCEPT_COMPENSATION", "OFFER_REFUND", "PROPOSE_REFUND", "PARTIAL_REFUND",
                    "OFFER_REPLACEMENT", "PROPOSE_REPLACEMENT", "RESEND_SHIPMENT", "REJECT", "REJECT_COMPLAINT",
                    "REQUEST_MORE_EVIDENCE", "RESPOND" -> "WAITING_BUYER_CONFIRMATION";
            default -> throw new IllegalArgumentException("Incident action is invalid");
        };
    }


    private String incidentEventDescription(String action, String status, String resolutionType, String note, BigDecimal compensationAmount) {
        String normalizedAction = action == null ? "RESPOND" : action.trim().toUpperCase(Locale.ROOT);
        String summary = switch (normalizedAction) {
            case "OFFER_COMPENSATION", "ACCEPT_COMPENSATION" -> "Nhà cung cấp đề xuất bồi hoàn";
            case "PARTIAL_REFUND", "OFFER_REFUND", "PROPOSE_REFUND" -> "Nhà cung cấp đề xuất hoàn tiền một phần";
            case "RESEND_SHIPMENT", "OFFER_REPLACEMENT", "PROPOSE_REPLACEMENT" -> "Nhà cung cấp đề xuất gửi lại hàng";
            case "REJECT", "REJECT_COMPLAINT" -> "Nhà cung cấp từ chối yêu cầu";
            case "REQUEST_MORE_EVIDENCE" -> "Nhà cung cấp yêu cầu thêm bằng chứng";
            default -> "Nhà cung cấp đã phản hồi sự cố";
        };
        if (compensationAmount != null) {
            summary = summary + " (" + formatMoney(compensationAmount) + ")";
        }
        if (resolutionType != null && !resolutionType.isBlank()
                && !summary.toUpperCase(Locale.ROOT).contains(resolutionType.toUpperCase(Locale.ROOT))) {
            summary = summary + " (" + resolutionType + ")";
        }
        return note == null || note.isBlank() ? summary : summary + ": " + note;
    }

    private String withCompensationAmount(String resolution, BigDecimal compensationAmount) {
        if (compensationAmount == null) {
            return resolution;
        }
        return resolution + "\nSố tiền bồi hoàn đề xuất: " + formatMoney(compensationAmount);
    }

    private List<String> parseEvidenceUrls(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .distinct()
                .toList();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = normalizeText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private OrderStatusEnum parseOrderStatus(String rawStatus) {
        try {
            return OrderStatusEnum.valueOf(rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Order status is invalid");
        }
    }

    private ShipmentStatusEnum parseShipmentStatus(String rawStatus) {
        try {
            return ShipmentStatusEnum.valueOf(rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Shipment status is invalid");
        }
    }

    private ShipmentStatusEnum normalizeShipmentStatus(ShipmentStatusEnum status) {
        if (status == null) {
            return ShipmentStatusEnum.PENDING;
        }
        if (status == ShipmentStatusEnum.SHIPPING) {
            return ShipmentStatusEnum.IN_TRANSIT;
        }
        return status;
    }

    private String shipmentEventDescription(ShipmentStatusEnum status) {
        return switch (status) {
            case PICKED_UP -> "Đã lấy hàng tại kho";
            case OUT_FOR_DELIVERY -> "Đang giao tới người nhận";
            case SHIPPED -> "Hàng đã rời kho nhà cung cấp";
            case IN_TRANSIT -> "Đơn hàng đang được vận chuyển";
            case WAITING_CONFIRMATION -> "Hàng đã giao tới nơi, chờ buyer xác nhận";
            default -> mapShipmentStatus(status);
        };
    }

    private String summarizeProducts(List<SupplierOrderDto.OrderItemSummaryDto> items) {
        if (items.isEmpty()) {
            return "N/A";
        }
        if (items.size() == 1) {
            SupplierOrderDto.OrderItemSummaryDto item = items.get(0);
            return item.product() + " · " + item.batchCode() + " · Grade " + item.grade() + " · Size " + item.size();
        }
        return items.stream()
                .sorted(Comparator.comparing(SupplierOrderDto.OrderItemSummaryDto::id,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(item -> item.product() + " · " + item.batchCode() + " · " + item.quantity())
                .collect(Collectors.joining("; "));
    }

    private String orderCode(OrderEntity order) {
        return order.getId() == null ? "ORD-N/A" : "ORD-" + order.getId();
    }

    private String formatDate(LocalDate value) {
        return value == null ? "N/A" : value.format(DATE_FORMATTER);
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "N/A" : value.format(DATE_FORMATTER);
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? "N/A" : value.format(DATE_TIME_FORMATTER);
    }

    private String mapOrderStatus(OrderStatusEnum status) {
        if (status == OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM
                || status == OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM
                || status == OrderStatusEnum.SUPPLIER_CONFIRMED) {
            return "Đã thanh toán";
        }
        if (status == null) {
            return "Chờ xác nhận";
        }
        return switch (status) {
            case PENDING_PAYMENT -> "Chờ thanh toán";
            case PENDING_DEPOSIT -> "Chờ thanh toán tiền cọc";
            case DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM -> "Đã cọc, chờ supplier xác nhận";
            case PAID_WAITING_SUPPLIER_CONFIRM -> "Đã thanh toán, chờ supplier xác nhận";
            case SUPPLIER_CONFIRMED -> "Supplier đã xác nhận";
            case PREPARING -> "Đang chuẩn bị hàng";
            case READY_TO_SHIP -> "Sẵn sàng giao hàng";
            case WAITING_FINAL_PAYMENT -> "Chờ thanh toán phần còn lại";
            case WAITING_BUYER_CONFIRM -> "Chờ buyer xác nhận nhận hàng";
            case COMPLETED -> "Hoàn tất";
            case DISPUTED -> "Đang khiếu nại";
            case REFUND_PENDING -> "Chờ hoàn tiền";
            case PARTIALLY_REFUNDED -> "Đã hoàn tiền một phần";
            case REFUNDED -> "Đã hoàn tiền";
            case PENDING_SUPPLIER_CONFIRMATION -> "Chờ nhà cung cấp xác nhận";
            case PENDING -> "Chờ xác nhận";
            case CONFIRMED -> "Đã xác nhận";
            case SHIPPING -> "Đang giao";
            case DELIVERED -> "Hoàn thành";
            case CANCELLED -> "Đã hủy";
        };
    }

    private String mapShipmentStatus(ShipmentStatusEnum rawStatus) {
        if (rawStatus == null) {
            return "Chưa tạo vận đơn";
        }
        ShipmentStatusEnum status = normalizeShipmentStatus(rawStatus);
        return switch (status) {
            case WAITING_PICKUP -> "Chờ lấy hàng";
            case PICKED_UP -> "Đã lấy hàng tại kho";
            case OUT_FOR_DELIVERY -> "Đang giao tới người nhận";
            case PENDING -> "Chờ lấy hàng";
            case CREATED -> "Đã tạo vận đơn";
            case SHIPPED -> "Đã rời kho";
            case IN_TRANSIT -> "Đang vận chuyển";
            case WAITING_CONFIRMATION -> "Chờ buyer xác nhận";
            case WAITING_REPLACEMENT -> "Chờ giao bù";
            case DELIVERED -> "Đã giao thành công";
            case CANCELLED -> "Đã hủy giao hàng";
            case INCIDENT, FAILED, FAILED_DELIVERY -> "Giao thất bại";
            case PREPARING -> "Chờ lấy hàng";
            case SHIPPING -> "Đang vận chuyển";
        };
    }

    private String statusCode(OrderStatusEnum status) {
        if (status == OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM
                || status == OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM) {
            return OrderStatusEnum.SUPPLIER_CONFIRMED.name();
        }
        return status == null ? OrderStatusEnum.PENDING.name() : status.name();
    }

    private String formatQuantity(BigDecimal value, String unit) {
        BigDecimal safeValue = safeAmount(value).stripTrailingZeros();
        return safeValue.toPlainString() + safeText(unit);
    }

    private String formatMoney(BigDecimal amount) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.US);
        format.setMaximumFractionDigits(0);
        return format.format(safeAmount(amount)) + "đ";
    }

    private BigDecimal safeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }


    private String safeText(String value) {
        return value == null || value.isBlank() ? "N/A" : value;
    }

    private String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String generateTrackingCode(Long orderId) {
        return "AGR-" + orderId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private record OrderLookup(
            Map<Long, List<OrderItemEntity>> itemsByOrderId,
            Map<Long, BatchEntity> batchById,
            Map<Long, ProductEntity> productById,
            Map<Long, CompanyEntity> buyerById,
            Map<Long, BranchEntity> branchById,
            Map<Long, ShipmentEntity> shipmentByOrderId) {
    }
}
