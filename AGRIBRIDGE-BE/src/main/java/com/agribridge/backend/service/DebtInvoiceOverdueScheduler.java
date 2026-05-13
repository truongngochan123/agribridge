package com.agribridge.backend.service;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final UserRepository userRepository;

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void markOverdueInvoices() {
        List<InvoiceEntity> invoices = invoiceRepository.findByStatusInAndDueDateBefore(
                List.of(InvoiceStatusEnum.UNPAID, InvoiceStatusEnum.PARTIAL, InvoiceStatusEnum.CREDIT_PENDING),
                LocalDate.now());
        invoices.forEach(invoice -> {
            OrderEntity order = orderRepository.findById(invoice.getOrderId()).orElse(null);
            ShipmentEntity shipment = invoice.getOrderId() == null ? null : shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(invoice.getOrderId()).orElse(null);
            if (!canMarkOverdue(invoice, order, shipment)) {
                return;
            }
            invoice.setStatus(InvoiceStatusEnum.OVERDUE);
            createBuyerPaymentDueReminder(invoice, order);
            createSupplierOverdueNotification(invoice, order);
        });
        invoiceRepository.saveAll(invoices);
    }

    private boolean canMarkOverdue(InvoiceEntity invoice, OrderEntity order, ShipmentEntity shipment) {
        if (order == null || OrderStatusEnum.CANCELLED.equals(order.getStatus())) return false;
        if (invoice.getDueDate() == null || !invoice.getDueDate().isBefore(LocalDate.now())) return false;
        if ("DEPOSIT_50".equalsIgnoreCase(invoice.getPaymentMethod())) {
            return shipment != null && shipment.getConfirmedReceivedAt() != null
                    && shipment.getStatus() != null && "DELIVERED".equals(shipment.getStatus().name());
        }
        return true;
    }

    private void createBuyerPaymentDueReminder(InvoiceEntity invoice, OrderEntity order) {
        String orderCode = "ORD-" + order.getId();
        String dueLabel = invoice.getDueDate() == null ? "chưa xác định" : invoice.getDueDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String body = "Đơn " + orderCode + " đã quá hạn thanh toán phần còn lại. Vui lòng thanh toán công nợ trước khi tiếp tục.";
        String metadata = "{"
                + "\"role\":\"buyer\""
                + ",\"invoiceId\":" + invoice.getId()
                + ",\"orderId\":" + order.getId()
                + ",\"orderCode\":\"" + orderCode + "\""
                + ",\"buyerCompanyId\":" + order.getBuyerCompanyId()
                + ",\"supplierCompanyId\":" + order.getSupplierCompanyId()
                + ",\"dueDate\":\"" + (invoice.getDueDate() == null ? "" : invoice.getDueDate()) + "\""
                + ",\"route\":\"/buyer/debt?supplierId=" + order.getSupplierCompanyId() + "&invoiceId=" + invoice.getId() + "&pay=1\""
                + ",\"type\":\"PAYMENT_DUE\""
                + "}";
        userRepository.findFirstByCompanyIdAndRole(order.getBuyerCompanyId(), UserRoleEnum.OWNER)
                .ifPresent(owner -> {
                    var existing = notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefId(
                            order.getBuyerCompanyId(), NotificationTypeEnum.PAYMENT_DUE, "invoices", invoice.getId()).stream().findFirst();
                    NotificationEntity notification = existing.orElseGet(NotificationEntity::new);
                    notification.setUserId(owner.getId());
                    notification.setCompanyId(order.getBuyerCompanyId());
                    notification.setType(NotificationTypeEnum.PAYMENT_DUE);
                    notification.setTitle("Nhắc thanh toán công nợ");
                    notification.setBody(body + " Hạn thanh toán: " + dueLabel + ".");
                    notification.setMetadata(metadata);
                    notification.setRefTable("invoices");
                    notification.setRefId(invoice.getId());
                    notification.setIsRead(Boolean.FALSE);
                    notification.setCreatedAt(LocalDateTime.now());
                    notificationRepository.save(notification);
                });
    }

    private void createSupplierOverdueNotification(InvoiceEntity invoice, OrderEntity order) {
        if (notificationRepository.findByCompanyIdAndTypeAndRefTableAndRefId(
                order.getSupplierCompanyId(), NotificationTypeEnum.DEBT_OVERDUE, "invoices", invoice.getId()).stream().findAny().isPresent()) {
            return;
        }
        String orderCode = "ORD-" + order.getId();
        String dueLabel = invoice.getDueDate() == null ? "chưa xác định" : invoice.getDueDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String body = "Đơn " + orderCode + " đã được Buyer xác nhận nhận hàng nhưng chưa thanh toán phần còn lại. Hạn thanh toán: " + dueLabel + ".";
        String metadata = "{"
                + "\"role\":\"supplier\""
                + ",\"invoiceId\":" + invoice.getId()
                + ",\"orderId\":" + order.getId()
                + ",\"orderCode\":\"" + orderCode + "\""
                + ",\"buyerCompanyId\":" + order.getBuyerCompanyId()
                + ",\"supplierCompanyId\":" + order.getSupplierCompanyId()
                + ",\"dueDate\":\"" + (invoice.getDueDate() == null ? "" : invoice.getDueDate()) + "\""
                + ",\"route\":\"/supplier/debt?buyerId=" + order.getBuyerCompanyId() + "&invoiceId=" + invoice.getId() + "\""
                + ",\"type\":\"DEBT_OVERDUE\""
                + "}";
        userRepository.findFirstByCompanyIdAndRole(order.getSupplierCompanyId(), UserRoleEnum.OWNER)
                .ifPresent(owner -> notificationRepository.save(NotificationEntity.builder()
                        .userId(owner.getId())
                        .companyId(order.getSupplierCompanyId())
                        .type(NotificationTypeEnum.DEBT_OVERDUE)
                        .title("Công nợ quá hạn")
                        .body(body)
                        .metadata(metadata)
                        .refTable("invoices")
                        .refId(invoice.getId())
                        .isRead(Boolean.FALSE)
                        .createdAt(LocalDateTime.now())
                        .build()));
    }
}
