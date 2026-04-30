package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerDeliveryDtos;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.ComplaintEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentIncidentRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.BuyerDeliveryService;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.MarketPriceAggregationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerDeliveryServiceImpl implements BuyerDeliveryService {

    private static final String VN_PHONE_PATTERN = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$";

    private final CurrentUserService currentUserService;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final ShipmentIncidentRepository shipmentIncidentRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final BranchRepository branchRepository;
    private final CompanyRepository companyRepository;
    private final ComplaintRepository complaintRepository;
    private final MarketPriceAggregationService marketPriceAggregationService;

    @Override
    @Transactional(readOnly = true)
    public List<BuyerDeliveryDtos.ListItem> getDeliveries(Long branchId, String status, String keyword, LocalDate fromDate, LocalDate toDate) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        if (branchId != null) {
            branchRepository.findByIdAndCompanyId(branchId, buyerCompanyId)
                    .orElseThrow(() -> new IllegalArgumentException("BRANCH_NOT_FOUND"));
        }
        ShipmentStatusEnum statusEnum = parseStatus(status);
        LocalDateTime from = fromDate == null ? null : fromDate.atStartOfDay();
        LocalDateTime to = toDate == null ? null : toDate.plusDays(1).atStartOfDay();
        List<ShipmentEntity> shipments = shipmentRepository.findBuyerShipments(
                buyerCompanyId,
                branchId,
                statusEnum,
                clean(keyword),
                from,
                to);
        return mapList(shipments);
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerDeliveryDtos.Detail getDelivery(Long shipmentId) {
        ShipmentEntity shipment = requireBuyerShipment(shipmentId);
        return toDetail(shipment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BuyerDeliveryDtos.TimelineEvent> getTimeline(Long shipmentId) {
        requireBuyerShipment(shipmentId);
        return shipmentEventRepository.findByShipmentIdOrderByEventTimeAsc(shipmentId).stream()
                .map(this::toTimeline)
                .toList();
    }

    @Override
    @Transactional
    public BuyerDeliveryDtos.Detail confirmReceived(Long shipmentId, BuyerDeliveryDtos.ConfirmReceivedRequest request) {
        ShipmentEntity shipment = requireBuyerShipment(shipmentId);
        UserEntity user = currentUserService.requireCurrentUser();
        if (shipment.getConfirmedReceivedAt() != null) {
            throw new IllegalArgumentException("SHIPMENT_ALREADY_CONFIRMED");
        }
        if (ShipmentStatusEnum.CANCELLED.equals(shipment.getStatus()) || ShipmentStatusEnum.FAILED.equals(shipment.getStatus())) {
            throw new IllegalArgumentException("SHIPMENT_CANNOT_BE_CONFIRMED");
        }
        if (request == null || !Boolean.TRUE.equals(request.confirmed())) {
            throw new IllegalArgumentException("confirmed checkbox is required");
        }
        String condition = clean(request.condition());
        if (condition == null) {
            throw new IllegalArgumentException("condition is required");
        }
        if (!"OK".equalsIgnoreCase(condition)) {
            createIncidentInternal(shipment, user.getId(), condition, firstText(request.note(), "Buyer reported delivery issue"), request.evidenceImage());
            return toDetail(shipmentRepository.findById(shipmentId).orElseThrow());
        }

        LocalDateTime now = LocalDateTime.now();
        shipment.setConfirmedReceivedAt(now);
        shipment.setConfirmedReceivedByUserId(user.getId());
        shipment.setDeliveredAt(shipment.getDeliveredAt() == null ? now : shipment.getDeliveredAt());
        shipment.setStatus(ShipmentStatusEnum.DELIVERED);
        shipmentRepository.save(shipment);

        OrderEntity order = orderRepository.findById(shipment.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        order.setStatus(OrderStatusEnum.DELIVERED);
        orderRepository.save(order);
        marketPriceAggregationService.updateFromOrder(order.getId());

        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(ShipmentStatusEnum.DELIVERED.name())
                .description(firstText(request.note(), "Buyer confirmed received shipment"))
                .eventTime(now)
                .build());
        return toDetail(shipment);
    }

    @Override
    @Transactional
    public BuyerDeliveryDtos.Incident createIncident(Long shipmentId, BuyerDeliveryDtos.IncidentRequest request) {
        ShipmentEntity shipment = requireBuyerShipment(shipmentId);
        Long userId = currentUserService.requireCurrentUser().getId();
        return toIncident(createIncidentInternal(
                shipment,
                userId,
                request == null ? null : request.incidentType(),
                request == null ? null : request.description(),
                request == null ? null : request.imageUrl()));
    }

    private ShipmentIncidentEntity createIncidentInternal(ShipmentEntity shipment, Long userId, String type, String description, String imageUrl) {
        String incidentType = firstText(type, "DELIVERY_ISSUE").toUpperCase(Locale.ROOT);
        String incidentDescription = required(description, "description is required");
        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(ShipmentStatusEnum.INCIDENT);
        shipment.setIncidentNote(incidentDescription);
        shipmentRepository.save(shipment);
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(ShipmentStatusEnum.INCIDENT.name())
                .description("Buyer reported incident: " + incidentDescription)
                .eventTime(now)
                .build());
        return shipmentIncidentRepository.save(ShipmentIncidentEntity.builder()
                .shipmentId(shipment.getId())
                .reportedByUserId(userId)
                .incidentType(incidentType)
                .description(incidentDescription)
                .imageUrl(clean(imageUrl))
                .status("OPEN")
                .createdAt(now)
                .build());
    }

    private ShipmentEntity requireBuyerShipment(Long shipmentId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        ShipmentEntity shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("SHIPMENT_NOT_FOUND"));
        OrderEntity order = orderRepository.findById(shipment.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("SHIPMENT_NOT_FOUND");
        }
        if (shipment.getDriverPhone() != null && !shipment.getDriverPhone().isBlank()
                && !shipment.getDriverPhone().trim().matches(VN_PHONE_PATTERN)) {
            throw new IllegalArgumentException("driverPhone must be a valid Vietnamese phone number");
        }
        return shipment;
    }

    private List<BuyerDeliveryDtos.ListItem> mapList(List<ShipmentEntity> shipments) {
        if (shipments.isEmpty()) {
            return List.of();
        }
        List<Long> orderIds = shipments.stream().map(ShipmentEntity::getOrderId).filter(Objects::nonNull).distinct().toList();
        Map<Long, OrderEntity> orders = orderRepository.findAllById(orderIds).stream()
                .collect(Collectors.toMap(OrderEntity::getId, Function.identity()));
        Map<Long, BranchEntity> branches = branchRepository.findByIdIn(
                        orders.values().stream().map(OrderEntity::getBranchId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(BranchEntity::getId, Function.identity()));
        Map<Long, CompanyEntity> suppliers = companyRepository.findAllById(
                        orders.values().stream().map(OrderEntity::getSupplierCompanyId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(CompanyEntity::getId, Function.identity()));
        Map<Long, List<OrderItemEntity>> itemsByOrder = orderItemRepository.findByOrderIdIn(orderIds).stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId));
        Map<Long, ProductEntity> products = productRepository.findAllById(
                        itemsByOrder.values().stream().flatMap(Collection::stream).map(OrderItemEntity::getProductId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));

        return shipments.stream()
                .map(shipment -> toListItem(
                        shipment,
                        orders.get(shipment.getOrderId()),
                        orders.get(shipment.getOrderId()) == null ? null : branches.get(orders.get(shipment.getOrderId()).getBranchId()),
                        orders.get(shipment.getOrderId()) == null ? null : suppliers.get(orders.get(shipment.getOrderId()).getSupplierCompanyId()),
                        itemsByOrder.getOrDefault(shipment.getOrderId(), List.of()),
                        products))
                .toList();
    }

    private BuyerDeliveryDtos.Detail toDetail(ShipmentEntity shipment) {
        OrderEntity order = orderRepository.findById(shipment.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        BranchEntity branch = order.getBranchId() == null ? null : branchRepository.findById(order.getBranchId()).orElse(null);
        CompanyEntity supplier = companyRepository.findById(order.getSupplierCompanyId()).orElse(null);
        List<OrderItemEntity> orderItems = orderItemRepository.findByOrderIdOrderByIdAsc(order.getId());
        Map<Long, ProductEntity> products = productRepository.findAllById(
                        orderItems.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, BatchEntity> batches = batchRepository.findAllById(
                        orderItems.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).distinct().toList()).stream()
                .collect(Collectors.toMap(BatchEntity::getId, Function.identity()));
        return new BuyerDeliveryDtos.Detail(
                toListItem(shipment, order, branch, supplier, orderItems, products),
                orderItems.stream().map(item -> toProductItem(item, products.get(item.getProductId()), batches.get(item.getBatchId()))).toList(),
                shipmentEventRepository.findByShipmentIdOrderByEventTimeAsc(shipment.getId()).stream().map(this::toTimeline).toList(),
                shipmentIncidentRepository.findByShipmentIdOrderByCreatedAtDesc(shipment.getId()).stream().map(this::toIncident).toList(),
                complaintRepository.findByOrderIdOrderByCreatedAtDesc(order.getId()).stream().map(this::toComplaint).toList());
    }

    private BuyerDeliveryDtos.ListItem toListItem(
            ShipmentEntity shipment,
            OrderEntity order,
            BranchEntity branch,
            CompanyEntity supplier,
            List<OrderItemEntity> items,
            Map<Long, ProductEntity> products) {
        String productsText = items.stream()
                .map(item -> {
                    ProductEntity product = products.get(item.getProductId());
                    return (product == null ? "N/A" : product.getName()) + " " + formatNumber(item.getQuantity()) + " " + firstText(item.getUnit(), "");
                })
                .collect(Collectors.joining(", "));
        String destination = firstText(shipment.getReceiverAddress(), branch == null ? null : branch.getDeliveryAddress());
        return new BuyerDeliveryDtos.ListItem(
                shipment.getId(),
                "SH-" + shipment.getId(),
                shipment.getTrackingCode(),
                order == null ? null : "ORD-" + order.getId(),
                supplier == null ? "N/A" : supplier.getName(),
                productsText.isBlank() ? "N/A" : productsText,
                firstText(destination, shipment.getReceiverProvince()),
                branch == null ? null : branch.getId(),
                branch == null ? "N/A" : branch.getName(),
                shipment.getDriverName(),
                shipment.getDriverPhone(),
                shipment.getVehicleInfo(),
                firstText(shipment.getCarrierName(), shipment.getProviderName()),
                shipment.getShippingFee(),
                shipment.getEstimatedDeliveryAt(),
                shipment.getEstimatedDeliveryTime(),
                shipment.getShippedAt(),
                shipment.getDeliveredAt(),
                shipment.getConfirmedReceivedAt(),
                shipment.getCurrentLocation(),
                shipment.getCurrentLat(),
                shipment.getCurrentLng(),
                shipment.getStatus().name(),
                statusLabel(shipment.getStatus()),
                progress(shipment.getStatus()));
    }

    private BuyerDeliveryDtos.ProductItem toProductItem(OrderItemEntity item, ProductEntity product, BatchEntity batch) {
        return new BuyerDeliveryDtos.ProductItem(
                item.getProductId(),
                product == null ? "N/A" : product.getName(),
                item.getBatchId(),
                batch == null ? "LOT-" + item.getBatchId() : firstText(batch.getQrCode(), "LOT-" + batch.getId()),
                batch == null ? null : batch.getGrade(),
                batch == null ? null : batch.getSize(),
                item.getQuantity(),
                firstText(item.getUnit(), product == null ? null : product.getUnit()),
                item.getPrice(),
                item.getSubtotal());
    }

    private BuyerDeliveryDtos.TimelineEvent toTimeline(ShipmentEventEntity event) {
        String status = event.getStatus();
        return new BuyerDeliveryDtos.TimelineEvent(
                event.getId(),
                status,
                statusLabel(status),
                event.getLocation(),
                event.getDescription(),
                event.getEventTime());
    }

    private BuyerDeliveryDtos.Incident toIncident(ShipmentIncidentEntity incident) {
        return new BuyerDeliveryDtos.Incident(
                incident.getId(),
                incident.getIncidentType(),
                incident.getDescription(),
                incident.getImageUrl(),
                incident.getStatus(),
                incident.getCreatedAt(),
                incident.getResolvedAt(),
                incident.getResolutionNote());
    }

    private BuyerDeliveryDtos.Complaint toComplaint(ComplaintEntity complaint) {
        return new BuyerDeliveryDtos.Complaint(
                complaint.getId(),
                complaint.getBatchId(),
                complaint.getTitle(),
                complaint.getDescription(),
                complaint.getStatus() == null ? null : complaint.getStatus().name(),
                complaint.getSeverity(),
                complaint.getCreatedAt(),
                complaint.getResolvedAt());
    }

    private ShipmentStatusEnum parseStatus(String raw) {
        String value = clean(raw);
        if (value == null) {
            return null;
        }
        try {
            return ShipmentStatusEnum.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("status is invalid");
        }
    }

    private int progress(ShipmentStatusEnum status) {
        return switch (status) {
            case PENDING -> 10;
            case PREPARING -> 25;
            case SHIPPED, SHIPPING -> 55;
            case IN_TRANSIT -> 75;
            case WAITING_CONFIRMATION -> 90;
            case DELIVERED -> 100;
            case INCIDENT, FAILED, CANCELLED -> 100;
        };
    }

    private String statusLabel(ShipmentStatusEnum status) {
        return statusLabel(status.name());
    }

    private String statusLabel(String status) {
        if (status == null) {
            return "N/A";
        }
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "PENDING" -> "Chờ xử lý";
            case "PREPARING" -> "Chuẩn bị";
            case "SHIPPED", "SHIPPING" -> "Đã xuất kho";
            case "IN_TRANSIT" -> "Đang giao";
            case "WAITING_CONFIRMATION" -> "Chờ xác nhận";
            case "DELIVERED" -> "Đã giao";
            case "INCIDENT" -> "Có sự cố";
            case "FAILED" -> "Giao thất bại";
            case "CANCELLED" -> "Đã hủy";
            default -> status;
        };
    }

    private String required(String value, String message) {
        String cleaned = clean(value);
        if (cleaned == null) {
            throw new IllegalArgumentException(message);
        }
        return cleaned;
    }

    private String firstText(String first, String fallback) {
        String cleaned = clean(first);
        return cleaned == null ? clean(fallback) : cleaned;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String formatNumber(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        BigDecimal normalized = value.stripTrailingZeros();
        return normalized.scale() <= 0 ? normalized.toPlainString() : normalized.toPlainString();
    }
}
