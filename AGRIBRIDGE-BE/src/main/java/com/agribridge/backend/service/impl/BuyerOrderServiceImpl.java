package com.agribridge.backend.service.impl;

import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.ShipmentEventEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ShipmentEventRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import com.agribridge.backend.service.BuyerOrderService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerOrderServiceImpl implements BuyerOrderService {

    private final OrderRepository orderRepository;
    private final ShipmentRepository shipmentRepository;
    private final ShipmentEventRepository shipmentEventRepository;

    @Override
    @Transactional
    public void confirmReceived(Long buyerCompanyId, Long orderId) {
        if (buyerCompanyId == null || orderId == null) {
            throw new IllegalArgumentException("Buyer company and order are required");
        }
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this buyer");
        }
        if (!OrderStatusEnum.CONFIRMED.equals(order.getStatus())) {
            throw new IllegalArgumentException("Only confirmed orders can be received");
        }

        ShipmentEntity shipment = shipmentRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Shipment not found"));
        if (!ShipmentStatusEnum.WAITING_CONFIRMATION.equals(shipment.getStatus())) {
            throw new IllegalArgumentException("Shipment is not waiting for buyer confirmation");
        }

        LocalDateTime now = LocalDateTime.now();
        shipment.setStatus(ShipmentStatusEnum.DELIVERED);
        shipment.setDeliveredAt(now);
        order.setStatus(OrderStatusEnum.DELIVERED);
        shipmentRepository.save(shipment);
        orderRepository.save(order);
        shipmentEventRepository.save(ShipmentEventEntity.builder()
                .shipmentId(shipment.getId())
                .status(ShipmentStatusEnum.DELIVERED.name())
                .description("Buyer đã xác nhận nhận hàng")
                .eventTime(now)
                .build());
    }
}
