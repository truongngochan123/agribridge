package com.agribridge.backend.service;

import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.QuoteEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentIncidentEntity;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public interface NotificationCenterService {

    void notifyCompanyOwner(
            Long companyId,
            NotificationTypeEnum type,
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata);

    NotificationEntity saveCompanyOwnerNotification(
            Long companyId,
            NotificationTypeEnum type,
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata);

    void notifyAdmins(
            String title,
            String body,
            String module,
            String actionUrl,
            String entityType,
            Long entityId,
            boolean actionRequired,
            Map<String, Object> metadata);

    void pushRealtime(NotificationEntity notification);

    void notifySupplierOrderCreated(OrderEntity order, String buyerName);

    void notifyBuyerOrderConfirmed(OrderEntity order, String supplierName);

    void notifyBuyerOrderCancelled(OrderEntity order, String supplierName);

    void notifySupplierOrderCancelledByBuyer(OrderEntity order, String buyerName);

    void notifySupplierDepositPaid(OrderEntity order, BigDecimal amount, String buyerName);

    void notifySupplierRemainingPaid(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, String buyerName);

    void notifyBuyerPaymentCompleted(OrderEntity order);

    void notifyBuyerDeliveryInTransit(OrderEntity order);

    void notifyBuyerDeliveryWaitingConfirmation(OrderEntity order);

    void notifyDeliveryFailed(OrderEntity order);

    void notifyBuyerPaymentRemainingRequired(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, LocalDate dueDate);

    void notifySupplierDebtOverdue(OrderEntity order, InvoiceEntity invoice, BigDecimal amount, LocalDate dueDate);

    void notifySuppliersNewRfq(RfqEntity rfq, String buyerName);

    void notifyBuyerQuoteSubmitted(RfqEntity rfq, QuoteEntity quote, String supplierName);

    void notifySupplierQuoteSelected(RfqEntity rfq, QuoteEntity quote, OrderEntity order);

    void notifySupplierComplaintCreated(OrderEntity order, Long complaintId, String buyerName);

    void notifySupplierShipmentIncidentCreated(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String buyerName);

    void notifyBuyerShipmentIncidentSupplierResponded(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String supplierName);

    void notifySupplierShipmentIncidentBuyerAction(OrderEntity order, ShipmentEntity shipment, ShipmentIncidentEntity incident, String buyerName, String action);
}
