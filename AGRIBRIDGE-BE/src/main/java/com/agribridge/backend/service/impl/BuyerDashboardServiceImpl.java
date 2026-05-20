package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerDashboardDtos;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.BuyerDashboardService;
import com.agribridge.backend.service.CurrentUserService;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerDashboardServiceImpl implements BuyerDashboardService {

    private static final Set<OrderStatusEnum> PENDING_ORDER_STATUSES = Set.of(
            OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION,
            OrderStatusEnum.PENDING,
            OrderStatusEnum.CONFIRMED);
    private static final Set<ShipmentStatusEnum> DELIVERY_STATUSES = Set.of(
            ShipmentStatusEnum.PENDING,
            ShipmentStatusEnum.PREPARING,
            ShipmentStatusEnum.SHIPPED,
            ShipmentStatusEnum.SHIPPING,
            ShipmentStatusEnum.IN_TRANSIT,
            ShipmentStatusEnum.WAITING_CONFIRMATION,
            ShipmentStatusEnum.INCIDENT);
    private static final Set<String> PAID_PAYMENT_STATUSES = Set.of("PAID", "COMPLETED", "CONFIRMED", "SUCCESS");

    private final CurrentUserService currentUserService;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final BatchRepository batchRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ShipmentRepository shipmentRepository;
    private final RfqRepository rfqRepository;
    private final QuoteRepository quoteRepository;

    @Override
    @Transactional(readOnly = true)
    public BuyerDashboardDtos.Response getDashboard() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        List<OrderEntity> orders = orderRepository.findByBuyerCompanyIdOrderByCreatedAtDesc(buyerCompanyId);
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();
        List<OrderItemEntity> items = orderIds.isEmpty() ? List.of() : orderItemRepository.findByOrderIdIn(orderIds);
        List<InvoiceEntity> invoices = orderIds.isEmpty() ? List.of() : invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<PaymentEntity> payments = invoices.isEmpty() ? List.of() : paymentRepository.findByInvoiceIdInOrderByPaymentDateDesc(invoices.stream().map(InvoiceEntity::getId).toList());
        List<ShipmentEntity> shipments = orderIds.isEmpty() ? List.of() : shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        List<RfqEntity> rfqs = rfqRepository.findByBuyerCompanyIdForBuyerPage(buyerCompanyId, null, null, org.springframework.data.domain.Pageable.unpaged()).getContent();

        BigDecimal payableDebt = calculatePayableDebt(invoices, payments);
        long pendingOrders = orders.stream().filter(order -> PENDING_ORDER_STATUSES.contains(order.getStatus())).count();
        List<BuyerDashboardDtos.Kpi> kpis = List.of(
                new BuyerDashboardDtos.Kpi("totalOrders", "Tong don hang", BigDecimal.valueOf(orders.size()), String.valueOf(orders.size())),
                new BuyerDashboardDtos.Kpi("pendingOrders", "Don cho xu ly", BigDecimal.valueOf(pendingOrders), String.valueOf(pendingOrders)),
                new BuyerDashboardDtos.Kpi("payableDebt", "Cong no phai tra", payableDebt, formatMoney(payableDebt)));

        LocalDate today = LocalDate.now();
        long dueSoonDebt = invoices.stream()
                .filter(invoice -> !InvoiceStatusEnum.PAID.equals(invoice.getStatus()))
                .filter(invoice -> invoice.getDueDate() != null && !invoice.getDueDate().isBefore(today) && !invoice.getDueDate().isAfter(today.plusDays(7)))
                .count();
        long expiringRfqs = rfqs.stream()
                .filter(rfq -> RfqStatusEnum.OPEN.equals(rfq.getStatus()))
                .filter(rfq -> rfq.getExpiredAt() != null && !rfq.getExpiredAt().isBefore(LocalDateTime.now()) && !rfq.getExpiredAt().isAfter(LocalDateTime.now().plusDays(2)))
                .count();
        long lateShipments = shipments.stream()
                .filter(shipment -> DELIVERY_STATUSES.contains(shipment.getStatus()))
                .filter(shipment -> shipment.getEstimatedDeliveryAt() != null && shipment.getEstimatedDeliveryAt().isBefore(LocalDateTime.now()))
                .count();
        List<BuyerDashboardDtos.Alert> alerts = List.of(
                new BuyerDashboardDtos.Alert("debtDueSoon", "Cong no sap den han", dueSoonDebt + " hoa don", dueSoonDebt > 0 ? "danger" : "info", "/buyer/debt"),
                new BuyerDashboardDtos.Alert("rfqExpiring", "RFQ sap het han", expiringRfqs + " RFQ", expiringRfqs > 0 ? "warning" : "info", "/buyer/rfq"),
                new BuyerDashboardDtos.Alert("lateShipments", "Shipment giao tre", lateShipments + " don", lateShipments > 0 ? "amber" : "info", "/buyer/delivery"));

        Map<Long, OrderEntity> orderById = orders.stream().collect(Collectors.toMap(OrderEntity::getId, Function.identity()));
        Map<Long, List<OrderItemEntity>> itemsByOrder = items.stream().collect(Collectors.groupingBy(OrderItemEntity::getOrderId));
        Map<Long, ProductEntity> products = productMap(items);
        Map<Long, BatchEntity> batches = batchMap(items);
        List<BuyerDashboardDtos.DeliveryOrder> deliveryOrders = shipments.stream()
                .filter(shipment -> DELIVERY_STATUSES.contains(shipment.getStatus()))
                .sorted(Comparator.comparing(ShipmentEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(8)
                .map(shipment -> {
                    OrderEntity order = orderById.get(shipment.getOrderId());
                    return new BuyerDashboardDtos.DeliveryOrder(
                            shipment.getOrderId(),
                            orderCode(shipment.getOrderId()),
                            productText(itemsByOrder.getOrDefault(shipment.getOrderId(), List.of()), products, batches),
                            shipment.getStatus() == null ? null : shipment.getStatus().name(),
                            shipmentLabel(shipment.getStatus()),
                            order == null ? BigDecimal.ZERO : nullToZero(order.getTotalAmount()),
                            formatMoney(order == null ? BigDecimal.ZERO : order.getTotalAmount()),
                            shipment.getId(),
                            shipment.getTrackingCode(),
                            shipment.getEstimatedDeliveryAt());
                })
                .toList();

        List<Long> rfqIds = rfqs.stream().map(RfqEntity::getId).toList();
        Map<Long, Long> quoteCountByRfq = rfqIds.isEmpty() ? Map.of() : quoteRepository.findByRfqIdIn(rfqIds).stream()
                .collect(Collectors.groupingBy(QuoteEntity::getRfqId, Collectors.counting()));
        List<BuyerDashboardDtos.PendingRfq> pendingRfqs = rfqs.stream()
                .filter(rfq -> RfqStatusEnum.OPEN.equals(rfq.getStatus()))
                .sorted(Comparator.comparing(RfqEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(8)
                .map(rfq -> new BuyerDashboardDtos.PendingRfq(
                        rfq.getId(),
                        rfqCode(rfq.getId()),
                        rfq.getTitle(),
                        rfq.getProduct() == null ? rfq.getTitle() : rfq.getProduct().getName(),
                        rfq.getQuantity(),
                        rfq.getUnit(),
                        rfq.getStatus() == null ? null : rfq.getStatus().name(),
                        quoteCountByRfq.getOrDefault(rfq.getId(), 0L).intValue(),
                        rfq.getExpiredAt(),
                        rfq.getDeliveryDate(),
                        rfq.getProvince()))
                .toList();

        return new BuyerDashboardDtos.Response(kpis, alerts, deliveryOrders, pendingRfqs);
    }

    private BigDecimal calculatePayableDebt(List<InvoiceEntity> invoices, List<PaymentEntity> payments) {
        Map<Long, BigDecimal> paidByInvoice = payments.stream()
                .filter(this::isPaidPayment)
                .collect(Collectors.groupingBy(
                        PaymentEntity::getInvoiceId,
                        Collectors.mapping(this::paidAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));
        return invoices.stream()
                .filter(invoice -> !InvoiceStatusEnum.PAID.equals(invoice.getStatus()))
                .map(invoice -> invoiceTotal(invoice).subtract(paidByInvoice.getOrDefault(invoice.getId(), BigDecimal.ZERO)))
                .filter(amount -> amount.compareTo(BigDecimal.ZERO) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<Long, ProductEntity> productMap(List<OrderItemEntity> items) {
        List<Long> ids = items.stream().map(OrderItemEntity::getProductId).filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of() : productRepository.findAllById(ids).stream().collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
    }

    private Map<Long, BatchEntity> batchMap(List<OrderItemEntity> items) {
        List<Long> ids = items.stream().map(OrderItemEntity::getBatchId).filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of() : batchRepository.findAllById(ids).stream().collect(Collectors.toMap(BatchEntity::getId, Function.identity()));
    }

    private String productText(List<OrderItemEntity> items, Map<Long, ProductEntity> products, Map<Long, BatchEntity> batches) {
        if (items == null || items.isEmpty()) return "N/A";
        return items.stream()
                .limit(2)
                .map(item -> {
                    ProductEntity product = products.get(item.getProductId());
                    if (product == null && item.getBatchId() != null) {
                        BatchEntity batch = batches.get(item.getBatchId());
                        product = batch == null ? null : products.get(batch.getProductId());
                    }
                    String name = product == null ? "San pham" : product.getName();
                    return name + " x " + formatQuantity(item.getQuantity()) + " " + nullToEmpty(firstText(item.getUnit(), product == null ? null : product.getUnit()));
                })
                .collect(Collectors.joining(", "));
    }

    private BigDecimal paidAmount(PaymentEntity payment) {
        return nullToZero(payment.getPaidAmount() == null ? payment.getAmount() : payment.getPaidAmount());
    }

    private BigDecimal invoiceTotal(InvoiceEntity invoice) {
        BigDecimal adjusted = nullToZero(invoice.getAdjustedAmount());
        return adjusted.compareTo(BigDecimal.ZERO) > 0 ? adjusted : nullToZero(invoice.getTotalAmount());
    }

    private boolean isPaidPayment(PaymentEntity payment) {
        String normalized = payment.getStatus() == null ? "" : payment.getStatus().trim().toUpperCase(Locale.ROOT);
        return PAID_PAYMENT_STATUSES.contains(normalized) || payment.getPaidAmount() != null;
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String firstText(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String orderCode(Long id) {
        return "ORD-" + String.format("%06d", id == null ? 0 : id);
    }

    private String rfqCode(Long id) {
        return "RFQ-" + String.format("%06d", id == null ? 0 : id);
    }

    private String shipmentLabel(ShipmentStatusEnum status) {
        if (status == null) return "N/A";
        return switch (status) {
            case CREATED, PENDING, PREPARING, WAITING_PICKUP -> "Cho giao";
            case PICKED_UP, SHIPPED, SHIPPING, IN_TRANSIT, OUT_FOR_DELIVERY -> "Dang giao";
            case WAITING_CONFIRMATION -> "Cho xac nhan";
            case DELIVERED -> "Da giao";
            case CANCELLED -> "Da huy";
            case FAILED, FAILED_DELIVERY -> "That bai";
            case INCIDENT -> "Co su co";
        };
    }

    private String formatMoney(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(new Locale("vi", "VN"));
        return format.format(nullToZero(value)) + "d";
    }

    private String formatQuantity(BigDecimal value) {
        return NumberFormat.getNumberInstance(new Locale("vi", "VN")).format(nullToZero(value));
    }
}
