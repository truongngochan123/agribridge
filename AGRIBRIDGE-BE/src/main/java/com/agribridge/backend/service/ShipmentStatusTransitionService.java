package com.agribridge.backend.service;

import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ShipmentStatusTransitionService {

    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;
    private final OrderRepository orderRepository;

    @Transactional
    public ShipmentEntity initializeDemoTracking(ShipmentEntity shipment, String createdDescription) {
        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(ShipmentStatusEnum.WAITING_PICKUP);
        shipment.setProgress(20);
        shipment.setAutoProgressEnabled(Boolean.TRUE);
        shipment.setDemoTrackingEnabled(Boolean.TRUE);
        shipment.setLastStatusChangedAt(now);
        shipment.setUpdatedAt(now);
        ShipmentEntity saved = shipmentRepository.save(shipment);
        saveEvent(saved, createdDescription, now);
        saveEvent(saved, "Chờ lấy hàng", now);
        return saved;
    }

    @Transactional
    public ShipmentEntity transition(ShipmentEntity shipment, ShipmentStatusEnum nextStatus, String description) {
        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(nextStatus);
        shipment.setProgress(progressFor(nextStatus));
        shipment.setLastStatusChangedAt(now);
        shipment.setUpdatedAt(now);
        if ((nextStatus == ShipmentStatusEnum.PICKED_UP || nextStatus == ShipmentStatusEnum.IN_TRANSIT
                || nextStatus == ShipmentStatusEnum.OUT_FOR_DELIVERY) && shipment.getShippedAt() == null) {
            shipment.setShippedAt(now);
        }
        if (nextStatus == ShipmentStatusEnum.WAITING_CONFIRMATION && shipment.getDeliveredAt() == null) {
            shipment.setDeliveredAt(now);
        }
        if (nextStatus == ShipmentStatusEnum.DELIVERED) {
            shipment.setDeliveredAt(shipment.getDeliveredAt() == null ? now : shipment.getDeliveredAt());
            shipment.setAutoProgressEnabled(Boolean.FALSE);
        }
        ShipmentEntity saved = shipmentRepository.save(shipment);
        saveEvent(saved, description, now);
        updateOrderForShipment(saved, nextStatus, now);
        return saved;
    }

    @Transactional
    public ShipmentEntity buyerConfirmReceived(ShipmentEntity shipment, Long buyerUserId, String note) {
        LocalDateTime now = LocalDateTime.now();
        shipment.setConfirmedReceivedAt(now);
        shipment.setConfirmedReceivedByUserId(buyerUserId);
        shipment.setDeliveredAt(shipment.getDeliveredAt() == null ? now : shipment.getDeliveredAt());
        shipment.setStatus(ShipmentStatusEnum.DELIVERED);
        shipment.setProgress(100);
        shipment.setAutoProgressEnabled(Boolean.FALSE);
        shipment.setLastStatusChangedAt(now);
        shipment.setUpdatedAt(now);
        ShipmentEntity saved = shipmentRepository.save(shipment);
        saveEvent(saved, note == null || note.isBlank() ? "Người mua xác nhận đã nhận hàng" : note, now);
        orderRepository.findById(saved.getOrderId()).ifPresent(order -> {
            if (order.getStatus() != OrderStatusEnum.CANCELLED && order.getStatus() != OrderStatusEnum.COMPLETED) {
                order.setStatus(OrderStatusEnum.DELIVERED);
            }
            order.setUpdatedAt(now);
            orderRepository.save(order);
        });
        return saved;
    }

    public int progressFor(ShipmentStatusEnum status) {
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
            case WAITING_REPLACEMENT -> 35;
            case CANCELLED, INCIDENT, FAILED, FAILED_DELIVERY -> 45;
        };
    }

    private void updateOrderForShipment(ShipmentEntity shipment, ShipmentStatusEnum status, LocalDateTime now) {
        OrderEntity order = orderRepository.findById(shipment.getOrderId()).orElse(null);
        if (order == null) {
            return;
        }
        if (status == ShipmentStatusEnum.PICKED_UP
                || status == ShipmentStatusEnum.IN_TRANSIT
                || status == ShipmentStatusEnum.OUT_FOR_DELIVERY) {
            if (order.getStatus() == OrderStatusEnum.READY_TO_SHIP
                    || order.getStatus() == OrderStatusEnum.PREPARING
                    || order.getStatus() == OrderStatusEnum.CONFIRMED) {
                order.setStatus(OrderStatusEnum.SHIPPING);
                order.setUpdatedAt(now);
                orderRepository.save(order);
            }
            return;
        }
        if (status == ShipmentStatusEnum.WAITING_CONFIRMATION && order.getStatus() != OrderStatusEnum.CANCELLED) {
            order.setStatus("DEPOSIT_50".equals(order.getPaymentOption()) && order.getRemainingAmount() != null
                    && order.getRemainingAmount().signum() > 0
                    ? OrderStatusEnum.WAITING_FINAL_PAYMENT
                    : OrderStatusEnum.WAITING_BUYER_CONFIRM);
            order.setUpdatedAt(now);
            orderRepository.save(order);
        }
    }

    private void saveEvent(ShipmentEntity shipment, String description, LocalDateTime now) {
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(shipment.getStatus().name())
                .description(description)
                .eventTime(now)
                .build());
    }
}
