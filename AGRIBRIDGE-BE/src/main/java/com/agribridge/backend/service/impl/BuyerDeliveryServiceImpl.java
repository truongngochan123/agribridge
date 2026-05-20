package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerDeliveryDtos;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.ComplaintEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.PaymentAllocationEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.ComplaintRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentAllocationRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentIncidentRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.BuyerDeliveryService;
import com.agribridge.backend.service.BuyerOrderService;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.MarketPriceAggregationService;
import com.agribridge.backend.service.NotificationCenterService;
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
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final ComplaintRepository complaintRepository;
    private final MarketPriceAggregationService marketPriceAggregationService;
    private final BuyerOrderService buyerOrderService;
    private final NotificationCenterService notificationCenterService;

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
        if (!ShipmentStatusEnum.WAITING_CONFIRMATION.equals(shipment.getStatus())) {
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
            createIncidentInternal(shipment, user.getId(), condition, firstText(request.note(), "Buyer reported delivery issue"), request.evidenceImage(), null, null, null);
            return toDetail(shipmentRepository.findById(shipmentId).orElseThrow());
        }

        OrderEntity order = orderRepository.findById(shipment.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        buyerOrderService.confirmReceived(order.getId());
        shipment = shipmentRepository.findById(shipment.getId()).orElseThrow();
        marketPriceAggregationService.updateFromOrder(order.getId());
        return toDetail(shipment);
    }

    @Override
    @Transactional
    public BuyerDeliveryDtos.Incident createIncident(Long shipmentId, BuyerDeliveryDtos.IncidentRequest request) {
        ShipmentEntity shipment = requireBuyerShipment(shipmentId);
        Long userId = currentUserService.requireCurrentUser().getId();

        // Validate: MISSING/DAMAGED/WRONG_PRODUCT chỉ được báo khi hàng đã tới
        if (request != null && request.incidentType() != null) {
            String type = request.incidentType().toUpperCase(Locale.ROOT);
            boolean isDeliveryOnlyType = java.util.Set.of("MISSING_ITEMS", "DAMAGED", "WRONG_PRODUCT").contains(type);
            boolean isReceived = shipment.getStatus() == ShipmentStatusEnum.WAITING_CONFIRMATION
                    || shipment.getStatus() == ShipmentStatusEnum.DELIVERED;
            if (isDeliveryOnlyType && !isReceived) {
                throw new IllegalArgumentException("INCIDENT_TYPE_NOT_ALLOWED_FOR_STATUS");
            }
        }

        return toIncident(createIncidentInternal(
                shipment,
                userId,
                request == null ? null : request.incidentType(),
                request == null ? null : request.description(),
                request == null ? null : request.imageUrl(),
                request == null ? null : request.evidenceUrls(),
                request == null ? null : request.missingQuantity(),
                request == null ? null : request.damagedQuantity()));
    }

    private ShipmentIncidentEntity createIncidentInternal(ShipmentEntity shipment, Long userId, String type, String description, String imageUrl, List<String> evidenceUrls, Integer missingQty, Integer damagedQty) {
        String incidentType = firstText(type, "DELIVERY_ISSUE").toUpperCase(Locale.ROOT);
        String incidentDescription = required(description, "description is required");
        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(ShipmentStatusEnum.INCIDENT);
        shipment.setIncidentNote(incidentDescription);
        shipmentRepository.save(shipment);
        String shortEventDesc = "Người mua báo sự cố: ";
        if ("MISSING_ITEMS".equals(incidentType)) {
            shortEventDesc += "Thiếu hàng" + (missingQty != null ? (" " + missingQty) : "");
        } else if ("DAMAGED".equals(incidentType)) {
            shortEventDesc += "Hàng lỗi/hư hỏng" + (damagedQty != null ? (" " + damagedQty) : "");
        } else if ("WRONG_PRODUCT".equals(incidentType)) {
            shortEventDesc += "Sai sản phẩm";
        } else if ("DELAY".equals(incidentType)) {
            shortEventDesc += "Giao trễ";
        } else if ("CONTACT_ISSUE".equals(incidentType)) {
            shortEventDesc += "Không liên hệ được tài xế/đơn vị giao hàng";
        } else {
            shortEventDesc += "Khác";
        }

        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(ShipmentStatusEnum.INCIDENT.name())
                .description(shortEventDesc)
                .eventTime(now)
                .build());
        List<String> evidence = new java.util.ArrayList<>();
        if (clean(imageUrl) != null) {
            evidence.add(clean(imageUrl));
        }
        if (evidenceUrls != null) {
            for (String url : evidenceUrls) {
                String cleaned = clean(url);
                if (cleaned != null && !evidence.contains(cleaned)) {
                    evidence.add(cleaned);
                }
            }
        }
        ShipmentIncidentEntity incident = shipmentIncidentRepository.save(ShipmentIncidentEntity.builder()
                .shipmentId(shipment.getId())
                .reportedByUserId(userId)
                .incidentType(incidentType)
                .description(incidentDescription)
                .imageUrl(clean(imageUrl))
                .evidenceUrls(evidence.isEmpty() ? null : String.join(",", evidence))
                .status("WAITING_SUPPLIER_RESPONSE")
                .createdAt(now)
                .build());
        OrderEntity order = orderRepository.findById(shipment.getOrderId()).orElse(null);
        if (order != null) {
            String buyerName = companyRepository.findById(order.getBuyerCompanyId())
                    .map(CompanyEntity::getName)
                    .orElse("Buyer");
            notificationCenterService.notifySupplierShipmentIncidentCreated(order, shipment, incident, buyerName);
        }
        return incident;
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
                complaintRepository.findByOrderIdOrderByCreatedAtDesc(order.getId()).stream().map(this::toComplaint).toList(),
                paymentDueInfo(order, orderItems, products, shipment));
    }

    private BuyerDeliveryDtos.PaymentDueInfo paymentDueInfo(
            OrderEntity order,
            List<OrderItemEntity> orderItems,
            Map<Long, ProductEntity> products,
            ShipmentEntity shipment) {
        if (order == null || shipment == null || shipment.getConfirmedReceivedAt() == null) {
            return null;
        }
        InvoiceEntity invoice = invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(List.of(order.getId())).stream()
                .findFirst()
                .orElse(null);
        if (invoice == null || invoice.getStatus() == null || "PAID".equals(invoice.getStatus().name())) {
            return null;
        }
        BigDecimal total = nullToZero(invoice.getAdjustedAmount()).compareTo(BigDecimal.ZERO) > 0
                ? invoice.getAdjustedAmount()
                : invoice.getTotalAmount();
        BigDecimal paid = paidAmount(invoice.getId());
        BigDecimal remaining = nullToZero(total).subtract(paid).max(BigDecimal.ZERO);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        OrderItemEntity firstItem = orderItems.isEmpty() ? null : orderItems.get(0);
        ProductEntity product = firstItem == null ? null : products.get(firstItem.getProductId());
        String invoiceCode = invoice.getInvoiceNumber();
        return new BuyerDeliveryDtos.PaymentDueInfo(
                invoice.getId(),
                invoiceCode,
                "INV-" + order.getId(),
                order.getId(),
                "ORD-" + order.getId(),
                companyRepository.findById(order.getSupplierCompanyId()).map(CompanyEntity::getName).orElse(null),
                product == null ? null : product.getName(),
                firstItem == null ? null : firstItem.getQuantity(),
                firstItem == null ? null : firstText(firstItem.getUnit(), product == null ? null : product.getUnit()),
                total,
                paid,
                remaining,
                invoice.getDueDate() == null ? shipment.getConfirmedReceivedAt().toLocalDate() : invoice.getDueDate(),
                "AGRI-DEBT-" + invoiceCode,
                firstText(invoice.getPaymentMethod(), "DEPOSIT_50"));
    }

    private BigDecimal paidAmount(Long invoiceId) {
        List<PaymentEntity> payments = paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoiceId);
        List<Long> paymentIds = payments.stream().map(PaymentEntity::getId).toList();
        List<PaymentAllocationEntity> allocations = paymentIds.isEmpty() ? List.of() : paymentAllocationRepository.findByPaymentIdIn(paymentIds);
        BigDecimal allocated = allocations.stream()
                .filter(allocation -> payments.stream().anyMatch(payment -> payment.getId().equals(allocation.getPaymentId()) && isPaidPayment(payment)))
                .map(PaymentAllocationEntity::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allocated.compareTo(BigDecimal.ZERO) > 0) {
            return allocated;
        }
        return payments.stream()
                .filter(this::isPaidPayment)
                .map(payment -> nullToZero(payment.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0 ? payment.getPaidAmount() : payment.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean isPaidPayment(PaymentEntity payment) {
        if (payment == null || payment.getStatus() == null) {
            return false;
        }
        return List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS").contains(payment.getStatus().trim().toUpperCase(Locale.ROOT));
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
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
                shipment.getProgress() == null ? progress(shipment.getStatus()) : shipment.getProgress(),
                shipment.getReceiverName(),
                shipment.getReceiverPhone(),
                buildFullAddress(shipment, order, branch),
                order == null ? null : order.getDeliveryName(),
                order == null ? null : order.getDeliveryPhone(),
                branch == null ? null : branch.getManagerName(),
                branch == null ? null : branch.getPhone(),
                branch == null ? null : branch.getAddress());
    }

    private BuyerDeliveryDtos.ProductItem toProductItem(OrderItemEntity item, ProductEntity product, BatchEntity batch) {
        return new BuyerDeliveryDtos.ProductItem(
                item.getProductId(),
                product == null ? "N/A" : product.getName(),
                item.getBatchId(),
                batch == null ? "LOT-" + item.getBatchId() : "LOT-" + batch.getId(),
                batch == null ? null : batch.getGrade(),
                batch == null ? null : batch.getSize(),
                item.getQuantity(),
                firstText(item.getUnit(), product == null ? null : product.getUnit()),
                item.getPrice(),
                item.getSubtotal(),
                batch == null ? null : batch.getQrCode());
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
        List<String> evidenceList = parseEvidenceUrls(incident.getEvidenceUrls());
        // Also include original imageUrl if present and not already in list
        if (incident.getImageUrl() != null && !incident.getImageUrl().isBlank()) {
            String origUrl = incident.getImageUrl().trim();
            if (!evidenceList.contains(origUrl)) {
                java.util.ArrayList<String> combined = new java.util.ArrayList<>(evidenceList);
                combined.add(0, origUrl);
                evidenceList = java.util.Collections.unmodifiableList(combined);
            }
        }
        return new BuyerDeliveryDtos.Incident(
                incident.getId(),
                incident.getIncidentType(),
                incident.getDescription(),
                incident.getImageUrl(),
                incident.getStatus(),
                incident.getCreatedAt(),
                incident.getResolvedAt(),
                incident.getResolutionNote(),
                incident.getMissingQuantity(),
                incident.getDamagedQuantity(),
                incident.getUpdateNote(),
                evidenceList,
                incident.getUpdatedAt(),
                incident.getSupplierResponse(),
                parseEvidenceUrls(incident.getSupplierEvidenceUrls()),
                incident.getProposedResolution(),
                incident.getResolutionType(),
                incident.getBuyerActionRequiredAt());
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

    @Override
    @Transactional
    public BuyerDeliveryDtos.Incident updateIncident(Long shipmentId, Long incidentId, BuyerDeliveryDtos.UpdateIncidentRequest request) {
        requireBuyerShipment(shipmentId);
        ShipmentIncidentEntity incident = shipmentIncidentRepository.findById(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("INCIDENT_NOT_FOUND"));
        if (!incident.getShipmentId().equals(shipmentId)) {
            throw new IllegalArgumentException("INCIDENT_NOT_FOUND");
        }
        String action = clean(request == null ? null : request.action());
        if (action != null) {
            return handleBuyerIncidentAction(shipment, incident, action, request);
        }
        if (!"OPEN".equals(incident.getStatus()) && !"PROCESSING".equals(incident.getStatus()) && !"PENDING_SUPPLIER_RESPONSE".equals(incident.getStatus()) && !"WAITING_SUPPLIER_RESPONSE".equals(incident.getStatus()) && !"WAITING_BUYER_RESPONSE".equals(incident.getStatus()) && !"WAITING_BUYER_CONFIRMATION".equals(incident.getStatus()) && !"NEGOTIATING".equals(incident.getStatus())) {
            throw new IllegalArgumentException("INCIDENT_NOT_EDITABLE");
        }

        LocalDateTime now = LocalDateTime.now();

        // Update note: append to existing if present
        if (request != null && clean(request.note()) != null) {
            String existing = clean(incident.getUpdateNote());
            String newNote = clean(request.note());
            incident.setUpdateNote(existing == null ? newNote : (existing + "\n---\n" + newNote));
        }

        // Update quantities if provided
        if (request != null && request.missingQuantity() != null) {
            if (request.missingQuantity() <= 0) {
                throw new IllegalArgumentException("missingQuantity must be > 0");
            }
            incident.setMissingQuantity(request.missingQuantity());
        }
        if (request != null && request.damagedQuantity() != null) {
            if (request.damagedQuantity() <= 0) {
                throw new IllegalArgumentException("damagedQuantity must be > 0");
            }
            incident.setDamagedQuantity(request.damagedQuantity());
        }

        // Merge new evidence URLs (imageUrl single + evidenceUrls list)
        List<String> existing = new java.util.ArrayList<>(parseEvidenceUrls(incident.getEvidenceUrls()));
        if (request != null && clean(request.imageUrl()) != null) {
            String url = clean(request.imageUrl());
            if (!existing.contains(url)) existing.add(url);
        }
        if (request != null && request.evidenceUrls() != null) {
            for (String url : request.evidenceUrls()) {
                if (clean(url) != null && !existing.contains(clean(url))) {
                    existing.add(clean(url));
                }
            }
        }
        incident.setEvidenceUrls(existing.isEmpty() ? null : String.join(",", existing));
        incident.setUpdatedAt(now);
        shipmentIncidentRepository.save(incident);

        // Timeline event
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipmentId)
                .status("INCIDENT")
                .description("Người mua cập nhật bằng chứng sự cố")
                .eventTime(now)
                .build());

        return toIncident(incident);
    }

    private BuyerDeliveryDtos.Incident handleBuyerIncidentAction(ShipmentEntity shipment, ShipmentIncidentEntity incident, String action, BuyerDeliveryDtos.UpdateIncidentRequest request) {
        String normalizedAction = action.toUpperCase(Locale.ROOT);
        String currentStatus = incident.getStatus() == null ? "" : incident.getStatus().toUpperCase(Locale.ROOT);
        if (!"WAITING_BUYER_CONFIRMATION".equals(currentStatus) && !"SUPPLIER_PROPOSED_RESOLUTION".equals(currentStatus) && !"NEGOTIATING".equals(currentStatus)) {
            throw new IllegalArgumentException("INCIDENT_NOT_WAITING_BUYER_CONFIRMATION");
        }
        LocalDateTime now = LocalDateTime.now();
        String note = clean(request == null ? null : request.note());
        String nextStatus = switch (normalizedAction) {
            case "ACCEPT_RESOLUTION" -> "RESOLVED";
            case "REJECT_RESOLUTION", "REQUEST_CONTINUE" -> "NEGOTIATING";
            case "ESCALATE" -> "ESCALATED";
            default -> throw new IllegalArgumentException("INCIDENT_ACTION_INVALID");
        };
        if (note != null) {
            String prefix = switch (normalizedAction) {
                case "ACCEPT_RESOLUTION" -> "Buyer đồng ý phương án";
                case "REJECT_RESOLUTION" -> "Buyer không đồng ý";
                case "REQUEST_CONTINUE" -> "Buyer yêu cầu xử lý tiếp";
                default -> "Buyer phản hồi";
            };
            String existing = clean(incident.getUpdateNote());
            String nextNote = prefix + ": " + note;
            incident.setUpdateNote(existing == null ? nextNote : existing + "\n---\n" + nextNote);
        }
        incident.setStatus(nextStatus);
        incident.setUpdatedAt(now);
        incident.setBuyerActionRequiredAt(null);
        if ("RESOLVED".equals(nextStatus)) {
            incident.setResolvedAt(now);
            incident.setResolutionNote(firstText(incident.getProposedResolution(), incident.getSupplierResponse(), note, "Buyer đã đồng ý phương án xử lý"));
        }
        shipmentIncidentRepository.save(incident);

        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status("DISPUTE_" + nextStatus)
                .description(buyerIncidentEventDescription(normalizedAction, note))
                .eventTime(now)
                .build());

        OrderEntity order = orderRepository.findById(shipment.getOrderId()).orElse(null);
        if (order != null) {
            String buyerName = companyRepository.findById(order.getBuyerCompanyId()).map(CompanyEntity::getName).orElse("Buyer");
            notificationCenterService.notifySupplierShipmentIncidentBuyerAction(order, shipment, incident, buyerName, normalizedAction);
        }
        return toIncident(incident);
    }

    private String buyerIncidentEventDescription(String action, String note) {
        String summary = switch (action) {
            case "ACCEPT_RESOLUTION" -> "Buyer đồng ý phương án xử lý";
            case "REJECT_RESOLUTION" -> "Buyer không đồng ý phương án xử lý";
            case "REQUEST_CONTINUE" -> "Buyer yêu cầu nhà cung cấp xử lý tiếp";
            case "ESCALATE" -> "Buyer chuyển sự cố lên xử lý cấp cao";
            default -> "Buyer phản hồi sự cố";
        };
        return note == null || note.isBlank() ? summary : summary + ": " + note;
    }

    private List<String> parseEvidenceUrls(String raw) {
        if (raw == null || raw.isBlank()) return new java.util.ArrayList<>();
        return new java.util.ArrayList<>(java.util.Arrays.stream(raw.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList());
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
        if (status == null) {
            return 15;
        }
        return switch (status) {
            case CREATED, PENDING, PREPARING, WAITING_PICKUP -> 20;
            case PICKED_UP, SHIPPED -> 40;
            case IN_TRANSIT, SHIPPING -> 65;
            case OUT_FOR_DELIVERY -> 80;
            case WAITING_CONFIRMATION -> 90;
            case DELIVERED -> 100;
            case CANCELLED, INCIDENT, FAILED, FAILED_DELIVERY -> 45;
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
            case "WAITING_PICKUP" -> "Chờ lấy hàng";
            case "PICKED_UP" -> "Đã lấy hàng tại kho";
            case "OUT_FOR_DELIVERY" -> "Đang giao tới người nhận";
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

    private String buildFullAddress(ShipmentEntity shipment, OrderEntity order, BranchEntity branch) {
        String addr = shipment.getReceiverAddress();
        String ward = shipment.getReceiverWard();
        String prov = shipment.getReceiverProvince();
        
        if (clean(addr) == null && clean(ward) == null && clean(prov) == null) {
            if (order != null) {
                addr = order.getDeliveryAddress();
                ward = order.getDeliveryWard();
                prov = order.getDeliveryProvince();
            }
        }
        
        java.util.List<String> parts = new java.util.ArrayList<>();
        if (clean(addr) != null) parts.add(clean(addr));
        if (clean(ward) != null) parts.add(clean(ward));
        if (clean(prov) != null) parts.add(clean(prov));
        
        if (parts.isEmpty() && branch != null) {
            if (clean(branch.getDeliveryAddress()) != null) return clean(branch.getDeliveryAddress());
            return clean(branch.getAddress());
        }
        
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private String formatNumber(BigDecimal value) {
        if (value == null) {
            return "0";
        }
        BigDecimal normalized = value.stripTrailingZeros();
        return normalized.scale() <= 0 ? normalized.toPlainString() : normalized.toPlainString();
    }
}
