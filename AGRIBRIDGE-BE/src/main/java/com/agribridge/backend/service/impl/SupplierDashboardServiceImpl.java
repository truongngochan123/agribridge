package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.SupplierDashboardResponseDto;
import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.OrderItemEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.ProductImageEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderItemRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.repository.ProductImageRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.SupplierDashboardService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierDashboardServiceImpl implements SupplierDashboardService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DecimalFormat MONEY_FORMAT = new DecimalFormat("#,###");

    private final CompanyRepository companyRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final BatchRepository batchRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final BranchRepository branchRepository;
    private final ShipmentRepository shipmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final QuoteRepository quoteRepository;
    private final RfqRepository rfqRepository;

    @Override
    @Transactional(readOnly = true)
    public SupplierDashboardResponseDto getDashboard(Long supplierCompanyId) {
        log.info("Loading supplier dashboard supplierCompanyId={}", supplierCompanyId);
        if (supplierCompanyId == null) {
            log.warn("Returning empty supplier dashboard because supplierCompanyId is null");
            return emptyDashboard();
        }
        Long resolvedSupplierId = supplierCompanyId;

        List<ProductEntity> products = productRepository
                .findBySupplierCompanyIdOrderByCreatedAtDesc(resolvedSupplierId);
        List<Long> productIds = products.stream().map(ProductEntity::getId).toList();
        Set<Long> supplierProductIds = productIds.stream().collect(Collectors.toSet());
        Set<Long> supplierCategoryIds = products.stream()
                .map(ProductEntity::getCategoryId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<String> supplierProvinces = new java.util.LinkedHashSet<>();
        companyRepository.findById(resolvedSupplierId)
                .map(CompanyEntity::getProvince)
                .map(this::normalizeKeyword)
                .filter(Objects::nonNull)
                .ifPresent(supplierProvinces::add);
        products.stream()
                .map(ProductEntity::getOriginProvince)
                .map(this::normalizeKeyword)
                .filter(Objects::nonNull)
                .forEach(supplierProvinces::add);

        List<BatchEntity> batches = productIds.isEmpty()
                ? Collections.emptyList()
                : batchRepository.findByProductIdInOrderByCreatedAtDesc(productIds);
        Map<Long, BatchEntity> latestBatchByProductId = new LinkedHashMap<>();
        for (BatchEntity batch : batches) {
            latestBatchByProductId.putIfAbsent(batch.getProductId(), batch);
        }

        Map<Long, String> imageByProductId = resolveProductImages(productIds);

        List<OrderEntity> orders = orderRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(resolvedSupplierId);
        List<Long> orderIds = orders.stream().map(OrderEntity::getId).toList();

        List<OrderItemEntity> orderItems = orderIds.isEmpty() ? Collections.emptyList()
                : orderItemRepository.findByOrderIdIn(orderIds);
        Map<Long, OrderItemEntity> firstItemByOrderId = new LinkedHashMap<>();
        for (OrderItemEntity item : orderItems) {
            firstItemByOrderId.putIfAbsent(item.getOrderId(), item);
        }

        Set<Long> batchIds = orderItems.stream()
                .map(OrderItemEntity::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, BatchEntity> batchById = batchIds.isEmpty()
                ? Collections.emptyMap()
                : batchRepository
                        .findAllById(Objects.requireNonNull(batchIds))
                        .stream()
                        .collect(Collectors.toMap(BatchEntity::getId, value -> value, (left, right) -> left));

        Map<Long, ProductEntity> productById = new LinkedHashMap<>();
        for (ProductEntity product : products) {
            productById.put(product.getId(), product);
        }
        Map<Long, CategoryEntity> categoryById = new LinkedHashMap<>();
        for (CategoryEntity category : categoryRepository.findAllById(supplierCategoryIds)) {
            categoryById.put(category.getId(), category);
        }

        Set<Long> missingProductIds = batchById.values().stream()
                .map(BatchEntity::getProductId)
                .filter(id -> !productById.containsKey(id))
                .collect(Collectors.toSet());
        if (!missingProductIds.isEmpty()) {
            for (ProductEntity product : productRepository.findByIdIn(missingProductIds)) {
                productById.put(product.getId(), product);
            }
        }

        Set<Long> buyerCompanyIds = orders.stream()
                .map(OrderEntity::getBuyerCompanyId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<ShipmentEntity> shipments = orderIds.isEmpty()
                ? Collections.emptyList()
                : shipmentRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);

        List<InvoiceEntity> invoices = orderIds.isEmpty()
                ? Collections.emptyList()
                : invoiceRepository.findByOrderIdInOrderByCreatedAtDesc(orderIds);
        Map<Long, InvoiceEntity> invoiceById = invoices.stream()
                .collect(Collectors.toMap(InvoiceEntity::getId, value -> value, (left, right) -> left));

        Map<Long, BigDecimal> paidByInvoiceId = paymentRepository
                .findByInvoiceIdInOrderByPaymentDateDesc(invoices.stream().map(InvoiceEntity::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(
                        PaymentEntity::getInvoiceId,
                        Collectors.reducing(BigDecimal.ZERO, this::effectivePaidAmount, BigDecimal::add)));

        Map<Long, BigDecimal> outstandingByInvoiceId = new LinkedHashMap<>();
        for (InvoiceEntity invoice : invoices) {
            BigDecimal paid = paidByInvoiceId.getOrDefault(invoice.getId(), BigDecimal.ZERO);
            BigDecimal outstanding = invoice.getAdjustedAmount().subtract(paid);
            if (outstanding.compareTo(BigDecimal.ZERO) < 0) {
                outstanding = BigDecimal.ZERO;
            }
            outstandingByInvoiceId.put(invoice.getId(), outstanding);
        }

        List<SupplierDashboardResponseDto.ProductLotDto> productLots = products.stream()
                .limit(12)
                .map(product -> toProductLot(product, latestBatchByProductId.get(product.getId()),
                        imageByProductId.get(product.getId())))
                .toList();

        List<QuoteEntity> quotes = quoteRepository.findBySupplierCompanyIdOrderByCreatedAtDesc(resolvedSupplierId);
        Map<Long, QuoteEntity> quoteByRfqId = selectBestQuoteByRfqId(quotes);
        List<Long> quoteIds = quotes.stream()
                .map(QuoteEntity::getId)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, OrderEntity> orderByQuoteId = quoteIds.isEmpty()
                ? Collections.emptyMap()
                : orderRepository.findByQuoteIdIn(quoteIds).stream()
                        .filter(order -> order.getQuoteId() != null)
                        .collect(Collectors.toMap(OrderEntity::getQuoteId, value -> value, (left, right) -> left));

        List<RfqEntity> rfqs = loadRelevantRfqs(
                supplierCategoryIds,
                supplierProductIds,
                supplierProvinces,
                quoteByRfqId.keySet());
        buyerCompanyIds.addAll(rfqs.stream()
                .map(RfqEntity::getBuyerCompanyId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        Map<Long, CompanyEntity> buyerByCompanyId = companyRepository.findAllById(Objects.requireNonNull(buyerCompanyIds))
                .stream()
                .collect(Collectors.toMap(CompanyEntity::getId, value -> value, (left, right) -> left));

        Map<Long, BranchEntity> branchById = branchRepository.findByIdIn(
                orders.stream().map(OrderEntity::getBranchId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(BranchEntity::getId, value -> value, (left, right) -> left));

        Map<Long, OrderEntity> orderById = orders.stream()
                .collect(Collectors.toMap(OrderEntity::getId, value -> value, (left, right) -> left));

        Set<Long> missingRfqProductIds = rfqs.stream()
                .map(RfqEntity::getProductId)
                .filter(Objects::nonNull)
                .filter(id -> !productById.containsKey(id))
                .collect(Collectors.toSet());
        if (!missingRfqProductIds.isEmpty()) {
            for (ProductEntity product : productRepository.findByIdIn(missingRfqProductIds)) {
                productById.put(product.getId(), product);
            }
        }
        Set<Long> missingCategoryIds = rfqs.stream()
                .map(RfqEntity::getCategoryId)
                .filter(Objects::nonNull)
                .filter(id -> !categoryById.containsKey(id))
                .collect(Collectors.toSet());
        if (!missingCategoryIds.isEmpty()) {
            for (CategoryEntity category : categoryRepository.findAllById(missingCategoryIds)) {
                categoryById.put(category.getId(), category);
            }
        }
        Map<Long, Long> quoteCountByRfqId = rfqs.isEmpty()
                ? Collections.emptyMap()
                : quoteRepository.findByRfqIdIn(rfqs.stream().map(RfqEntity::getId).toList())
                        .stream()
                        .collect(Collectors.groupingBy(QuoteEntity::getRfqId, Collectors.counting()));

        List<SupplierDashboardResponseDto.RfqDto> rfqItems = rfqs.stream()
                .sorted(Comparator
                        .comparingInt((RfqEntity rfq) -> relevanceScore(rfq, supplierCategoryIds, supplierProductIds,
                                supplierProvinces))
                        .reversed()
                        .thenComparing(RfqEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(RfqEntity::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(20)
                .map(rfq -> toRfqDto(
                        rfq,
                        quoteByRfqId.get(rfq.getId()),
                        buyerByCompanyId,
                        productById,
                        categoryById,
                        quoteCountByRfqId.getOrDefault(rfq.getId(), 0L),
                        orderByQuoteId))
                .toList();

        List<SupplierDashboardResponseDto.OrderDto> orderDtos = orders.stream()
                .limit(20)
                .map(order -> toOrderDto(order, buyerByCompanyId.get(order.getBuyerCompanyId()),
                        branchById.get(order.getBranchId()),
                        firstItemByOrderId.get(order.getId()), batchById, productById))
                .toList();

        List<SupplierDashboardResponseDto.ShipmentDto> shipmentDtos = shipments.stream()
                .limit(20)
                .map(shipment -> toShipmentDto(shipment, orderById.get(shipment.getOrderId()), buyerByCompanyId))
                .toList();

        BigDecimal revenueThisMonth = orders.stream()
                .filter(order -> order.getCreatedAt() != null
                        && YearMonth.from(order.getCreatedAt()).equals(YearMonth.now()))
                .map(OrderEntity::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long shippingOrderCount = orders.stream()
                .filter(order -> OrderStatusEnum.SHIPPING.equals(order.getStatus()))
                .count();

        BigDecimal totalReceivable = outstandingByInvoiceId.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal overdueReceivable = invoices.stream()
                .filter(invoice -> invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now()))
                .map(invoice -> outstandingByInvoiceId.getOrDefault(invoice.getId(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<SupplierDashboardResponseDto.MetricCardDto> overviewCards = List.of(
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Doanh thu tháng này",
                        formatCompactMoney(revenueThisMonth),
                        "Tính theo đơn hàng đã tạo",
                        null),
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Đơn hàng mới",
                        String.valueOf(orders.size()),
                        "Toàn bộ đơn của nhà cung cấp",
                        null),
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Đang giao hàng",
                        String.valueOf(shippingOrderCount),
                        "Theo trạng thái SHIPPING",
                        null),
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Công nợ phải thu",
                        formatCompactMoney(totalReceivable),
                        "Chưa thanh toán hết",
                        null));

        List<SupplierDashboardResponseDto.RevenuePointDto> monthlyRevenue = buildMonthlyRevenue(orders);

        List<SupplierDashboardResponseDto.ActivityDto> recentActivities = orders.stream()
                .limit(6)
                .map(order -> {
                    CompanyEntity buyer = buyerByCompanyId.get(order.getBuyerCompanyId());
                    String buyerName = buyer != null ? buyer.getName() : "Khách hàng";
                    String title = String.format(
                            Locale.ROOT,
                            "Đơn hàng #%d từ %s - %s",
                            order.getId(),
                            buyerName,
                            formatMoney(order.getTotalAmount()));
                    String time = order.getCreatedAt() == null ? "N/A" : order.getCreatedAt().format(DATE_FORMATTER);
                    return new SupplierDashboardResponseDto.ActivityDto("ORD-" + order.getId(), title, time, time);
                })
                .toList();

        List<SupplierDashboardResponseDto.MetricCardDto> debtSummaryCards = List.of(
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Tổng phải thu",
                        formatCompactMoney(totalReceivable),
                        "Từ " + invoices.size() + " hóa đơn",
                        null),
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Tổng quá hạn",
                        formatCompactMoney(overdueReceivable),
                        "Đến hạn chưa thanh toán",
                        null),
                new SupplierDashboardResponseDto.MetricCardDto(
                        "Đã thu tháng này",
                        formatCompactMoney(totalPaidThisMonth(paidByInvoiceId, invoiceById)),
                        "Theo ngày thanh toán",
                        null));

        List<SupplierDashboardResponseDto.DebtCustomerDto> debtCustomers = buildDebtCustomers(
                invoices,
                outstandingByInvoiceId,
                orderById,
                buyerByCompanyId);

        SupplierDashboardResponseDto response = new SupplierDashboardResponseDto(
                overviewCards,
                monthlyRevenue,
                recentActivities,
                productLots,
                rfqItems,
                orderDtos,
                shipmentDtos,
                debtSummaryCards,
                debtCustomers);
        log.info("Loaded supplier dashboard supplierCompanyId={} products={} orders={} shipments={} invoices={}",
                supplierCompanyId, products.size(), orders.size(), shipments.size(), invoices.size());
        return response;
    }

    private List<SupplierDashboardResponseDto.DebtCustomerDto> buildDebtCustomers(
            List<InvoiceEntity> invoices,
            Map<Long, BigDecimal> outstandingByInvoiceId,
            Map<Long, OrderEntity> orderById,
            Map<Long, CompanyEntity> buyerByCompanyId) {
        Map<Long, List<InvoiceEntity>> invoicesByBuyer = new LinkedHashMap<>();
        for (InvoiceEntity invoice : invoices) {
            OrderEntity order = orderById.get(invoice.getOrderId());
            if (order == null) {
                continue;
            }
            invoicesByBuyer.computeIfAbsent(order.getBuyerCompanyId(), key -> new ArrayList<>()).add(invoice);
        }

        List<SupplierDashboardResponseDto.DebtCustomerDto> items = new ArrayList<>();
        for (Map.Entry<Long, List<InvoiceEntity>> entry : invoicesByBuyer.entrySet()) {
            CompanyEntity buyer = buyerByCompanyId.get(entry.getKey());
            String buyerName = buyer != null ? buyer.getName() : "Khách hàng";

            BigDecimal totalDebt = BigDecimal.ZERO;
            BigDecimal overdueDebt = BigDecimal.ZERO;
            LocalDate latestDueDate = null;

            for (InvoiceEntity invoice : entry.getValue()) {
                BigDecimal outstanding = outstandingByInvoiceId.getOrDefault(invoice.getId(), BigDecimal.ZERO);
                totalDebt = totalDebt.add(outstanding);
                if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(LocalDate.now())) {
                    overdueDebt = overdueDebt.add(outstanding);
                }
                if (invoice.getDueDate() != null
                        && (latestDueDate == null || invoice.getDueDate().isAfter(latestDueDate))) {
                    latestDueDate = invoice.getDueDate();
                }
            }

            BigDecimal creditLimit = buyer != null && buyer.getCreditLimit() != null ? buyer.getCreditLimit()
                    : BigDecimal.ZERO;
            String status = "Tốt";
            if (overdueDebt.compareTo(BigDecimal.ZERO) > 0) {
                status = "Quá hạn";
            } else if (creditLimit.compareTo(BigDecimal.ZERO) > 0 && totalDebt.compareTo(creditLimit) > 0) {
                status = "Cảnh báo";
            }

            items.add(new SupplierDashboardResponseDto.DebtCustomerDto(
                    buyerName,
                    entry.getValue().size() + " hóa đơn",
                    latestDueDate == null ? "-" : latestDueDate.format(DATE_FORMATTER),
                    formatMoney(totalDebt),
                    overdueDebt.compareTo(BigDecimal.ZERO) > 0 ? formatMoney(overdueDebt) : "—",
                    creditLimit.compareTo(BigDecimal.ZERO) > 0 ? formatMoney(creditLimit) : "—",
                    status));
        }

        items.sort(Comparator
                .comparing((SupplierDashboardResponseDto.DebtCustomerDto item) -> parseMoney(item.totalDebt()))
                .reversed());
        return items;
    }

    private List<SupplierDashboardResponseDto.RevenuePointDto> buildMonthlyRevenue(List<OrderEntity> orders) {
        YearMonth current = YearMonth.now();
        Map<YearMonth, BigDecimal> revenueByMonth = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            revenueByMonth.put(current.minusMonths(i), BigDecimal.ZERO);
        }

        for (OrderEntity order : orders) {
            if (order.getCreatedAt() == null) {
                continue;
            }
            YearMonth month = YearMonth.from(order.getCreatedAt());
            if (!revenueByMonth.containsKey(month)) {
                continue;
            }
            revenueByMonth.put(month, revenueByMonth.get(month).add(order.getTotalAmount()));
        }

        List<SupplierDashboardResponseDto.RevenuePointDto> points = new ArrayList<>();
        for (Map.Entry<YearMonth, BigDecimal> entry : revenueByMonth.entrySet()) {
            long valueInMillions = entry.getValue().divide(BigDecimal.valueOf(1_000_000L), 0, RoundingMode.HALF_UP)
                    .longValue();
            points.add(new SupplierDashboardResponseDto.RevenuePointDto(
                    "T" + entry.getKey().getMonthValue(),
                    Math.max(valueInMillions, 0)));
        }
        return points;
    }

    private SupplierDashboardResponseDto.ShipmentDto toShipmentDto(
            ShipmentEntity shipment,
            OrderEntity order,
            Map<Long, CompanyEntity> buyerByCompanyId) {
        CompanyEntity buyer = order == null ? null : buyerByCompanyId.get(order.getBuyerCompanyId());
        String route = order == null
                ? (shipment.getShippingMethod() == null ? "N/A" : shipment.getShippingMethod())
                : (buyer != null ? buyer.getName() : "Khách hàng") + " - " + safeText(order.getDeliveryProvince());
        String cargo = order == null ? "N/A" : formatMoney(order.getTotalAmount());
        String shippingFeeStr = shipment.getShippingFee() != null ? formatMoney(shipment.getShippingFee()) : "—";
        String createdAtStr = shipment.getCreatedAt() != null
                ? shipment.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                : "N/A";

        return new SupplierDashboardResponseDto.ShipmentDto(
                "SH-" + shipment.getId(),
                order == null ? "N/A" : "ORD-" + order.getId(),
                route,
                safeText(shipment.getDriverName()),
                safeText(shipment.getDriverPhone()),
                shipmentEta(shipment),
                cargo,
                mapShipmentProgress(shipment.getStatus()),
                mapShipmentStatus(shipment.getStatus()),
                shippingFeeStr,
                safeText(shipment.getReceiverName()),
                safeText(shipment.getReceiverPhone()),
                buildFullAddress(shipment),
                safeText(shipment.getProviderName()),
                safeText(shipment.getServiceName()),
                safeText(shipment.getEstimatedDeliveryTime()),
                createdAtStr,
                order == null ? null : order.getId());
    }

    private String buildFullAddress(ShipmentEntity shipment) {
        StringBuilder sb = new StringBuilder();
        if (shipment.getReceiverAddress() != null && !shipment.getReceiverAddress().isBlank()) {
            sb.append(shipment.getReceiverAddress().trim());
        }
        if (shipment.getReceiverWard() != null && !shipment.getReceiverWard().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(shipment.getReceiverWard().trim());
        }
        if (shipment.getReceiverProvince() != null && !shipment.getReceiverProvince().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(shipment.getReceiverProvince().trim());
        }
        return sb.length() > 0 ? sb.toString() : "N/A";
    }


    private SupplierDashboardResponseDto.OrderDto toOrderDto(
            OrderEntity order,
            CompanyEntity buyer,
            BranchEntity branch,
            OrderItemEntity firstItem,
            Map<Long, BatchEntity> batchById,
            Map<Long, ProductEntity> productById) {
        String productName = "N/A";
        String quantity = "0kg";

        if (firstItem != null) {
            BatchEntity batch = batchById.get(firstItem.getBatchId());
            if (batch != null) {
                ProductEntity product = productById.get(batch.getProductId());
                if (product != null) {
                    productName = product.getName();
                }
            }
            quantity = formatQuantity(firstItem.getQuantity());
        }

        return new SupplierDashboardResponseDto.OrderDto(
                "ORD-" + order.getId(),
                buyer != null ? buyer.getName() : "Khách hàng",
                branch != null ? branch.getName() : "Chi nhánh",
                productName,
                quantity,
                formatMoney(order.getTotalAmount()),
                mapOrderStatus(order.getStatus()),
                order.getCreatedAt() == null ? "N/A" : order.getCreatedAt().format(DATE_FORMATTER));
    }

    private SupplierDashboardResponseDto.ProductLotDto toProductLot(ProductEntity product, BatchEntity batch,
            String imageUrl) {
        String lotCode = batch == null ? "LOT-N/A" : "LOT-" + batch.getId();
        String grade = batch == null ? "-" : safeText(batch.getGrade());
        String size = batch == null ? "-" : safeText(batch.getSize());
        String stock = batch == null ? "0kg" : formatQuantity(batch.getQuantity());
        String moq = batch == null || batch.getMoq() == null ? "0kg" : formatQuantity(batch.getMoq());
        String price = batch == null ? "0đ" : formatMoney(batch.getPrice());
        String status = mapBatchStatus(batch == null ? null : batch.getStatus());
        String image = imageUrl == null || imageUrl.isBlank() ? "/images/seafood-market.jpg" : imageUrl;

        return new SupplierDashboardResponseDto.ProductLotDto(
                "P-" + product.getId(),
                product.getName(),
                lotCode,
                grade,
                size,
                stock,
                moq,
                price,
                status,
                image);
    }

    private Map<Long, String> resolveProductImages(Collection<Long> productIds) {
        if (productIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, String> images = new LinkedHashMap<>();
        for (ProductImageEntity image : productImageRepository.findByProductIdIn(productIds)) {
            images.putIfAbsent(image.getProductId(), image.getImageUrl());
        }
        return images;
    }

    private BigDecimal totalPaidThisMonth(Map<Long, BigDecimal> paidByInvoiceId, Map<Long, InvoiceEntity> invoiceById) {
        YearMonth now = YearMonth.now();
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, BigDecimal> entry : paidByInvoiceId.entrySet()) {
            InvoiceEntity invoice = invoiceById.get(entry.getKey());
            if (invoice == null || invoice.getCreatedAt() == null) {
                continue;
            }
            if (YearMonth.from(invoice.getCreatedAt()).equals(now)) {
                total = total.add(entry.getValue());
            }
        }
        return total;
    }

    private SupplierDashboardResponseDto emptyDashboard() {
        return new SupplierDashboardResponseDto(
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList());
    }

    private List<RfqEntity> loadRelevantRfqs(
            Set<Long> supplierCategoryIds,
            Set<Long> supplierProductIds,
            Set<String> supplierProvinces,
            Set<Long> quotedRfqIds) {
        boolean hasRelevantFilters = !supplierCategoryIds.isEmpty()
                || !supplierProductIds.isEmpty()
                || !supplierProvinces.isEmpty();

        List<RfqEntity> relevantOpenRfqs = hasRelevantFilters
                ? rfqRepository.findRelevantOpenRfqs(
                        RfqStatusEnum.OPEN,
                        java.time.LocalDateTime.now(),
                        !supplierCategoryIds.isEmpty(),
                        supplierCategoryIds.isEmpty() ? List.of(-1L) : supplierCategoryIds,
                        !supplierProductIds.isEmpty(),
                        supplierProductIds.isEmpty() ? List.of(-1L) : supplierProductIds,
                        !supplierProvinces.isEmpty(),
                        supplierProvinces.isEmpty() ? List.of("__unmatched__") : supplierProvinces)
                : Collections.emptyList();

        List<RfqEntity> quotedRfqs = quotedRfqIds.isEmpty()
                ? Collections.emptyList()
                : rfqRepository.findByIdIn(quotedRfqIds);

        Map<Long, RfqEntity> rfqById = new LinkedHashMap<>();
        for (RfqEntity rfq : relevantOpenRfqs) {
            rfqById.put(rfq.getId(), rfq);
        }
        for (RfqEntity rfq : quotedRfqs) {
            rfqById.put(rfq.getId(), rfq);
        }

        return new ArrayList<>(rfqById.values());
    }

    private Map<Long, QuoteEntity> selectBestQuoteByRfqId(List<QuoteEntity> quotes) {
        if (quotes.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, QuoteEntity> quoteByRfqId = new LinkedHashMap<>();
        for (QuoteEntity quote : quotes) {
            if (quote == null || quote.getRfqId() == null) {
                continue;
            }
            QuoteEntity current = quoteByRfqId.get(quote.getRfqId());
            if (current == null || compareQuotePriority(quote, current) < 0) {
                quoteByRfqId.put(quote.getRfqId(), quote);
            }
        }
        return quoteByRfqId;
    }

    private int compareQuotePriority(QuoteEntity left, QuoteEntity right) {
        int statusCompare = Integer.compare(quoteStatusPriority(left), quoteStatusPriority(right));
        if (statusCompare != 0) {
            return statusCompare;
        }

        Comparator<java.time.LocalDateTime> createdAtComparator = Comparator.nullsLast(Comparator.reverseOrder());
        int createdAtCompare = createdAtComparator.compare(left.getCreatedAt(), right.getCreatedAt());
        if (createdAtCompare != 0) {
            return createdAtCompare;
        }

        return Comparator.<Long>nullsLast(Comparator.reverseOrder()).compare(left.getId(), right.getId());
    }

    private int quoteStatusPriority(QuoteEntity quote) {
        if (quote == null || quote.getStatus() == null) {
            return 4;
        }

        return switch (quote.getStatus().trim().toUpperCase(Locale.ROOT)) {
            case "ACCEPTED", "APPROVED" -> 1;
            case "PENDING" -> 2;
            case "REJECTED" -> 3;
            default -> 4;
        };
    }

    private SupplierDashboardResponseDto.RfqDto toRfqDto(
            RfqEntity rfq,
            QuoteEntity quote,
            Map<Long, CompanyEntity> buyerByCompanyId,
            Map<Long, ProductEntity> productById,
            Map<Long, CategoryEntity> categoryById,
            long quoteCount,
            Map<Long, OrderEntity> orderByQuoteId) {
        CompanyEntity buyer = rfq == null ? null : buyerByCompanyId.get(rfq.getBuyerCompanyId());
        ProductEntity product = rfq == null ? null : productById.get(rfq.getProductId());
        CategoryEntity category = rfq == null ? null : categoryById.get(rfq.getCategoryId());

        String quantity = rfq == null || rfq.getQuantity() == null ? "0"
                : rfq.getQuantity().stripTrailingZeros().toPlainString();
        if (rfq != null && rfq.getUnit() != null && !rfq.getUnit().isBlank()) {
            quantity = quantity + " " + rfq.getUnit();
        }

        String dueDate = rfq == null || rfq.getExpiredAt() == null
                ? "N/A"
                : rfq.getExpiredAt().toLocalDate().format(DATE_FORMATTER);
        String deliveryDate = rfq == null || rfq.getDeliveryDate() == null
                ? "N/A"
                : rfq.getDeliveryDate().format(DATE_FORMATTER);
        String supplierQuoteStatus = mapRfqDisplayStatus(rfq, quote);
        String supplierQuotedPrice = quote != null ? formatMoney(quote.getPrice()) : "Chưa báo giá";
        String supplierQuotedQuantity = quote == null || quote.getQuantity() == null
                ? "Chưa báo giá"
                : quote.getQuantity().stripTrailingZeros().toPlainString()
                        + (rfq != null && rfq.getUnit() != null && !rfq.getUnit().isBlank() ? " " + rfq.getUnit() : "");

        return new SupplierDashboardResponseDto.RfqDto(
                "RFQ-" + (rfq == null ? "N/A" : rfq.getId()),
                buyer != null ? buyer.getName() : "Khách hàng",
                product != null ? product.getName() : (rfq != null ? safeText(rfq.getTitle()) : "N/A"),
                category != null ? safeText(category.getName()) : "N/A",
                quantity,
                quote != null ? formatMoney(quote.getPrice()) : "Thỏa thuận",
                supplierQuotedPrice,
                supplierQuotedQuantity,
                dueDate,
                deliveryDate,
                rfq == null ? "N/A" : safeText(rfq.getProvince()),
                rfq == null ? "N/A" : safeText(rfq.getDescription()),
                quoteCount,
                supplierQuoteStatus,
                quote == null ? null : quote.getDeliveryDays(),
                quote == null ? "" : safeTextOrEmpty(quote.getNote()),
                quote != null,
                supplierQuoteStatus,
                quote == null ? null : quote.getId(),
                quote == null ? null : safeTextOrEmpty(quote.getStatus()),
                quote == null || quote.getId() == null || orderByQuoteId.get(quote.getId()) == null
                        ? null
                        : orderByQuoteId.get(quote.getId()).getId());
    }

    private int relevanceScore(
            RfqEntity rfq,
            Set<Long> supplierCategoryIds,
            Set<Long> supplierProductIds,
            Set<String> supplierProvinces) {
        if (rfq == null) {
            return 0;
        }

        int score = 0;
        if (rfq.getProductId() != null && supplierProductIds.contains(rfq.getProductId())) {
            score += 6;
        }
        if (rfq.getCategoryId() != null && supplierCategoryIds.contains(rfq.getCategoryId())) {
            score += 4;
        }
        String province = normalizeKeyword(rfq.getProvince());
        if (province != null && supplierProvinces.contains(province)) {
            score += 2;
        }
        return score;
    }

    private String normalizeKeyword(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String mapRfqDisplayStatus(RfqEntity rfq, QuoteEntity quote) {
        if (rfq != null && RfqStatusEnum.CANCELLED.equals(rfq.getStatus())) {
            return "Đã hủy";
        }
        if (quote == null) {
            return "Chờ báo giá";
        }

        String normalized = quote.getStatus() == null ? "" : quote.getStatus().trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACCEPTED", "APPROVED" -> "Chấp nhận";
            case "REJECTED" -> "Từ chối";
            case "PENDING", "SENT", "DRAFT" -> "Đã báo giá";
            default -> "Đã báo giá";
        };
    }

    private String mapBatchStatus(BatchStatusEnum status) {
        if (status == null) {
            return "Sắp hết";
        }
        return switch (status) {
            case AVAILABLE -> "Con hàng";
            case RESERVED, SOLD_OUT -> "Sắp hết";
        };
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

    private String mapShipmentStatus(ShipmentStatusEnum status) {
        if (status == null) {
            return "Chuẩn bị";
        }
        return switch (status) {
            case PENDING, PREPARING -> "Chuẩn bị";
            case SHIPPED -> "Đã rời kho";
            case IN_TRANSIT, SHIPPING -> "Đang vận chuyển";
            case WAITING_CONFIRMATION -> "Chờ buyer xác nhận";
            case DELIVERED -> "Đã giao";
            case CANCELLED -> "Đã hủy";
            case INCIDENT, FAILED -> "Sự cố";
        };
    }

    private int mapShipmentProgress(ShipmentStatusEnum status) {
        if (status == null) {
            return 15;
        }
        return switch (status) {
            case PENDING, PREPARING -> 20;
            case SHIPPED -> 45;
            case IN_TRANSIT, SHIPPING -> 65;
            case WAITING_CONFIRMATION -> 85;
            case DELIVERED -> 100;
            case CANCELLED, INCIDENT, FAILED -> 45;
        };
    }

    private BigDecimal effectivePaidAmount(PaymentEntity payment) {
        if (payment == null) {
            return BigDecimal.ZERO;
        }
        return payment.getPaidAmount() == null ? payment.getAmount() : payment.getPaidAmount();
    }

    private String shipmentEta(ShipmentEntity shipment) {
        if (shipment.getDeliveredAt() != null) {
            return "Hoàn thành";
        }
        if (shipment.getShippedAt() != null) {
            return "Đang xử lý";
        }
        return "Đang chuẩn bị";
    }

    private String safeText(String value) {
        if (value == null || value.isBlank()) {
            return "N/A";
        }
        return value;
    }

    private String safeTextOrEmpty(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value;
    }

    private String formatQuantity(BigDecimal value) {
        if (value == null) {
            return "0kg";
        }
        return MONEY_FORMAT.format(value) + "kg";
    }

    private String formatMoney(BigDecimal amount) {
        BigDecimal safeAmount = amount == null ? BigDecimal.ZERO : amount;
        return MONEY_FORMAT.format(safeAmount) + "đ";
    }

    private String formatCompactMoney(BigDecimal amount) {
        BigDecimal safeAmount = amount == null ? BigDecimal.ZERO : amount;
        if (safeAmount.compareTo(BigDecimal.valueOf(1_000_000_000L)) >= 0) {
            BigDecimal billion = safeAmount.divide(BigDecimal.valueOf(1_000_000_000L), 1, RoundingMode.HALF_UP);
            return billion + " tỷ";
        }
        if (safeAmount.compareTo(BigDecimal.valueOf(1_000_000L)) >= 0) {
            BigDecimal million = safeAmount.divide(BigDecimal.valueOf(1_000_000L), 0, RoundingMode.HALF_UP);
            return million + " tr";
        }
        return formatMoney(safeAmount);
    }

    private BigDecimal parseMoney(String raw) {
        if (raw == null) {
            return BigDecimal.ZERO;
        }
        String normalized = raw.replace("đ", "").replace(",", "").replace(" ", "");
        if (normalized.endsWith("tr")) {
            String value = normalized.substring(0, normalized.length() - 2);
            return new BigDecimal(value).multiply(BigDecimal.valueOf(1_000_000L));
        }
        if (normalized.endsWith("tỷ")) {
            String value = normalized.substring(0, normalized.length() - 2);
            return new BigDecimal(value).multiply(BigDecimal.valueOf(1_000_000_000L));
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }
}
