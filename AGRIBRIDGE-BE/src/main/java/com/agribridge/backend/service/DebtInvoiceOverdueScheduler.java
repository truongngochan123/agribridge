package com.agribridge.backend.service;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DebtInvoiceOverdueScheduler {

    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;
    private final ShipmentRepository shipmentRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationCenterService notificationCenterService;

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void markOverdueInvoices() {
        List<InvoiceEntity> invoices = invoiceRepository.findByStatusInAndDueDateBefore(
                List.of(InvoiceStatusEnum.UNPAID, InvoiceStatusEnum.PARTIAL, InvoiceStatusEnum.CREDIT_PENDING),
                LocalDate.now());
        invoices.forEach(invoice -> {
            OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElse(null);
            ShipmentEntity shipment = invoice.getOrderId() == null
                    ? null
                    : shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(invoice.getOrderId()).orElse(null);
            if (!canMarkOverdue(invoice, order, shipment)) {
                return;
            }
            invoice.setStatus(InvoiceStatusEnum.OVERDUE);
            createBuyerOverdueNotification(invoice, order);
            createSupplierOverdueNotification(invoice, order);
        });
        invoiceRepository.saveAll(invoices);
    }

    private boolean canMarkOverdue(InvoiceEntity invoice, OrderEntity order, ShipmentEntity shipment) {
        if (order == null || OrderStatusEnum.CANCELLED.equals(order.getStatus())) return false;
        if (invoice.getDueDate() == null || !invoice.getDueDate().isBefore(LocalDate.now())) return false;
        if ("DEPOSIT_50".equalsIgnoreCase(invoice.getPaymentMethod())) {
            return shipment != null
                    && shipment.getConfirmedReceivedAt() != null
                    && shipment.getStatus() != null
                    && "DELIVERED".equals(shipment.getStatus().name());
        }
        return true;
    }

    private void createBuyerOverdueNotification(InvoiceEntity invoice, OrderEntity order) {
        if (notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefId(
                order.getBuyerCompanyId(), NotificationTypeEnum.PAYMENT_REMAINING_REQUIRED, "invoice", invoice.getId()).stream().findAny().isPresent()) {
            return;
        }
        notificationCenterService.notifyBuyerPaymentRemainingRequired(order, invoice, outstandingAmount(invoice), invoice.getDueDate());
    }

    private void createSupplierOverdueNotification(InvoiceEntity invoice, OrderEntity order) {
        if (notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefId(
                order.getSupplierCompanyId(), NotificationTypeEnum.DEBT_OVERDUE, "invoice", invoice.getId()).stream().findAny().isPresent()) {
            return;
        }
        notificationCenterService.notifySupplierDebtOverdue(order, invoice, outstandingAmount(invoice), invoice.getDueDate());
    }

    private BigDecimal outstandingAmount(InvoiceEntity invoice) {
        if (invoice.getAdjustedAmount() != null) return invoice.getAdjustedAmount();
        if (invoice.getTotalAmount() != null) return invoice.getTotalAmount();
        return BigDecimal.ZERO;
    }
}
