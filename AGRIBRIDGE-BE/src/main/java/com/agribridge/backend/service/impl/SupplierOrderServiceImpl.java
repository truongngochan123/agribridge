package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CreateSupplierShipmentDto;
import com.agribridge.backend.dto.SupplierOrderDetailDto;
import com.agribridge.backend.dto.SupplierOrderDto;
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
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentRepository;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SupplierOrderServiceImpl implements SupplierOrderService {

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
                        .map(item -> toDetailItem(item, lookup.batchById().get(item.getBatchId()), lookup.productById()))
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

        OrderEntity saved = orderRepository.save(order);
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
                .trackingCode(normalizeText(request.trackingCode()) == null ? generateTrackingCode(orderId) : normalizeText(request.trackingCode()))
                .incidentNote(normalizeText(request.note()))
                .status(ShipmentStatusEnum.PREPARING)
                .feeConfirmed(Boolean.FALSE)
                .createdAt(now)
                .build();
        ShipmentEntity saved = shipmentRepository.save(shipment);
        saveShipmentEvent(saved, "Đã tạo vận đơn");

        return toOrderDto(order, buildLookup(List.of(order)));
    }

    @Override
    @Transactional
    public SupplierOrderDto updateShipmentStatus(Long supplierCompanyId, Long orderId, UpdateSupplierShipmentStatusDto request) {
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

        return toOrderDto(order, buildLookup(List.of(order)));
    }

    private void confirmOrder(OrderEntity order) {
        if (!OrderStatusEnum.PENDING.equals(order.getStatus())
                && !OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only pending orders can be confirmed");
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
            if (batch.getQuantity() == null || item.getQuantity() == null || batch.getQuantity().compareTo(item.getQuantity()) < 0) {
                throw new IllegalArgumentException("Batch quantity is not enough");
            }
        }
        order.setStatus(OrderStatusEnum.CONFIRMED);
    }

    private void cancelOrder(OrderEntity order) {
        if (OrderStatusEnum.DELIVERED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Delivered orders cannot be cancelled");
        }
        ShipmentEntity shipment = findActiveShipment(order.getId());
        ShipmentStatusEnum status = shipment == null ? null : normalizeShipmentStatus(shipment.getStatus());
        if (status == ShipmentStatusEnum.SHIPPED
                || status == ShipmentStatusEnum.IN_TRANSIT
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
        Map<Long, ProductEntity> productById = loadProducts(batchById.values().stream().map(BatchEntity::getProductId).toList());
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
                lookup.buyerById().get(order.getBuyerCompanyId()) == null ? "Khach hang" : safeText(lookup.buyerById().get(order.getBuyerCompanyId()).getName()),
                lookup.branchById().get(order.getBranchId()) == null ? "Chi nhanh" : safeText(lookup.branchById().get(order.getBranchId()).getName()),
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
            case PENDING_SUPPLIER_CONFIRMATION -> List.of("VIEW_DETAIL", "CONFIRM_ORDER", "CANCEL_ORDER");
            case PENDING -> List.of("VIEW_DETAIL", "CONFIRM_ORDER", "CANCEL_ORDER");
            case CONFIRMED -> {
                if (shipment == null || shipmentStatus == ShipmentStatusEnum.CANCELLED || shipmentStatus == ShipmentStatusEnum.FAILED) {
                    yield List.of("VIEW_DETAIL", "CREATE_SHIPMENT", "CANCEL_ORDER");
                }
                yield switch (shipmentStatus) {
                    case PENDING, PREPARING -> List.of("VIEW_DETAIL", "START_SHIPPING");
                    case SHIPPED -> List.of("VIEW_DETAIL", "MARK_IN_TRANSIT");
                    case IN_TRANSIT -> List.of("VIEW_DETAIL", "MARK_ARRIVED", "REPORT_INCIDENT");
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
            case PENDING, PREPARING -> next == ShipmentStatusEnum.SHIPPED;
            case SHIPPED -> next == ShipmentStatusEnum.IN_TRANSIT;
            case IN_TRANSIT -> next == ShipmentStatusEnum.WAITING_CONFIRMATION;
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
                .sorted(Comparator.comparing(SupplierOrderDto.OrderItemSummaryDto::id, Comparator.nullsLast(Comparator.naturalOrder())))
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
        if (status == null) {
            return "Chờ xác nhận";
        }
        return switch (status) {
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
            case PENDING -> "Chờ lấy hàng";
            case SHIPPED -> "Đã rời kho";
            case IN_TRANSIT -> "Đang vận chuyển";
            case WAITING_CONFIRMATION -> "Chờ buyer xác nhận";
            case DELIVERED -> "Đã giao thành công";
            case CANCELLED -> "Đã hủy giao hàng";
            case FAILED -> "Giao thất bại";
            case PREPARING -> "Chờ lấy hàng";
            case SHIPPING -> "Đang vận chuyển";
        };
    }

    private String statusCode(OrderStatusEnum status) {
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
