package com.agribridge.backend.service;

import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.ShipmentEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.ShipmentIncidentRepository;
import com.agribridge.backend.repository.ShipmentRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class AutoShipmentProgressScheduler {

    private static final Duration STEP_DELAY = Duration.ofMinutes(1);
    private static final Set<String> DEMO_PROVIDERS = Set.of("GHN", "MANUAL", "INTERNAL");
    private static final List<ShipmentStatusEnum> AUTO_STATUSES = List.of(
            ShipmentStatusEnum.WAITING_PICKUP,
            ShipmentStatusEnum.PICKED_UP,
            ShipmentStatusEnum.IN_TRANSIT,
            ShipmentStatusEnum.OUT_FOR_DELIVERY);

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final ShipmentIncidentRepository shipmentIncidentRepository;
    private final GhnShippingService ghnShippingService;
    private final ShipmentStatusTransitionService transitionService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void autoProgressDemoShipments() {
        List<ShipmentEntity> shipments = shipmentRepository
                .findByStatusInAndAutoProgressEnabledTrueOrderByLastStatusChangedAtAsc(AUTO_STATUSES);
        for (ShipmentEntity shipment : shipments) {
            try {
                progressOne(shipment);
            } catch (Exception ex) {
                log.warn("Auto shipment progress skipped shipmentId={}: {}", shipment.getId(), ex.getMessage());
            }
        }
    }

    private void progressOne(ShipmentEntity shipment) {
        if (!isEligible(shipment)) {
            return;
        }
        ShipmentStatusEnum current = shipment.getStatus();
        ShipmentStatusEnum ghnStatus = syncGhnIfAhead(shipment, current);
        if (ghnStatus != null && rank(ghnStatus) > rank(current)) {
            transitionService.transition(shipment, ghnStatus, "Đồng bộ GHN: " + labelFor(ghnStatus));
            return;
        }

        LocalDateTime anchor = shipment.getLastStatusChangedAt() != null
                ? shipment.getLastStatusChangedAt()
                : shipment.getCreatedAt();
        if (anchor != null && anchor.plus(STEP_DELAY).isAfter(LocalDateTime.now())) {
            return;
        }
        ShipmentStatusEnum next = nextStatus(current);
        if (next == null) {
            return;
        }
        transitionService.transition(shipment, next, labelFor(next));
    }

    private boolean isEligible(ShipmentEntity shipment) {
        if (shipment == null || shipment.getStatus() == null) {
            return false;
        }
        String provider = shipment.getProviderCode() == null ? "" : shipment.getProviderCode().trim().toUpperCase();
        if (!DEMO_PROVIDERS.contains(provider)) {
            return false;
        }
        if (!Boolean.TRUE.equals(shipment.getAutoProgressEnabled())
                && !Boolean.TRUE.equals(shipment.getDemoTrackingEnabled())) {
            return false;
        }
        OrderEntity order = orderRepository.findById(shipment.getOrderId()).orElse(null);
        if (order != null && (order.getStatus() == OrderStatusEnum.CANCELLED
                || order.getStatus() == OrderStatusEnum.DISPUTED)) {
            return false;
        }
        return !shipmentIncidentRepository.existsByShipmentIdAndStatusIn(
                shipment.getId(),
                List.of("OPEN", "PROCESSING"));
    }

    private ShipmentStatusEnum syncGhnIfAhead(ShipmentEntity shipment, ShipmentStatusEnum current) {
        if (!"GHN".equalsIgnoreCase(shipment.getProviderCode()) || shipment.getGhnOrderCode() == null) {
            return null;
        }
        try {
            var detail = ghnShippingService.syncGhnOrderStatus(shipment.getGhnOrderCode());
            if (detail == null || detail.data() == null) {
                return null;
            }
            ShipmentStatusEnum mapped = ghnShippingService.mapGhnStatusToShipmentStatus(detail.data().status());
            return rank(mapped) > rank(current) ? mapped : null;
        } catch (Exception ex) {
            log.debug("GHN detail sync ignored for shipmentId={}: {}", shipment.getId(), ex.getMessage());
            return null;
        }
    }

    private ShipmentStatusEnum nextStatus(ShipmentStatusEnum status) {
        return switch (status) {
            case WAITING_PICKUP -> ShipmentStatusEnum.PICKED_UP;
            case PICKED_UP -> ShipmentStatusEnum.IN_TRANSIT;
            case IN_TRANSIT -> ShipmentStatusEnum.OUT_FOR_DELIVERY;
            case OUT_FOR_DELIVERY -> ShipmentStatusEnum.WAITING_CONFIRMATION;
            default -> null;
        };
    }

    private int rank(ShipmentStatusEnum status) {
        if (status == null) {
            return 0;
        }
        return switch (status) {
            case CREATED, PENDING, PREPARING, WAITING_PICKUP -> 1;
            case PICKED_UP, SHIPPED -> 2;
            case IN_TRANSIT, SHIPPING -> 3;
            case OUT_FOR_DELIVERY -> 4;
            case WAITING_CONFIRMATION -> 5;
            case DELIVERED -> 6;
            case WAITING_REPLACEMENT, INCIDENT, CANCELLED, FAILED, FAILED_DELIVERY -> 99;
        };
    }

    private String labelFor(ShipmentStatusEnum status) {
        return switch (status) {
            case PICKED_UP -> "Đã lấy hàng tại kho";
            case IN_TRANSIT -> "Đang vận chuyển";
            case OUT_FOR_DELIVERY -> "Đang giao tới người nhận";
            case WAITING_CONFIRMATION -> "Đã giao tới nơi, chờ người mua xác nhận";
            default -> status.name();
        };
    }
}
