package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CreateSupplierShipmentDto;
import com.agribridge.backend.dto.SupplierOrderDetailDto;
import com.agribridge.backend.dto.SupplierOrderDto;
import com.agribridge.backend.dto.SupplierShipmentIncidentActionDto;
import com.agribridge.backend.dto.UpdateSupplierOrderStatusDto;
import com.agribridge.backend.dto.UpdateSupplierShipmentStatusDto;
import com.agribridge.backend.service.SupplierOrderService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier/orders")
@RequiredArgsConstructor
public class SupplierOrderController {

    private final SupplierOrderService supplierOrderService;

    @GetMapping
    public List<SupplierOrderDto> getOrders(@RequestParam Long companyId) {
        return supplierOrderService.getSupplierOrders(companyId);
    }

    @GetMapping("/{orderId}")
    public SupplierOrderDetailDto getOrderDetail(@PathVariable Long orderId, @RequestParam Long companyId) {
        return supplierOrderService.getSupplierOrderDetail(companyId, orderId);
    }

    @PatchMapping("/{orderId}/status")
    public SupplierOrderDto updateStatus(
            @PathVariable Long orderId,
            @RequestParam Long companyId,
            @Valid @RequestBody UpdateSupplierOrderStatusDto request) {
        return supplierOrderService.updateSupplierOrderStatus(companyId, orderId, request);
    }

    @PostMapping("/{orderId}/shipments")
    public SupplierOrderDto createShipment(
            @PathVariable Long orderId,
            @RequestParam Long companyId,
            @RequestBody CreateSupplierShipmentDto request) {
        return supplierOrderService.createShipment(companyId, orderId, request);
    }

    @PatchMapping("/{orderId}/shipment/status")
    public SupplierOrderDto updateShipmentStatus(
            @PathVariable Long orderId,
            @RequestParam Long companyId,
            @Valid @RequestBody UpdateSupplierShipmentStatusDto request) {
        return supplierOrderService.updateShipmentStatus(companyId, orderId, request);
    }

    @PostMapping("/{orderId}/confirm")
    public SupplierOrderDto confirm(@PathVariable Long orderId) {
        return supplierOrderService.confirmDemoOrder(orderId);
    }

    @PostMapping("/{orderId}/prepare")
    public SupplierOrderDto prepare(@PathVariable Long orderId) {
        return supplierOrderService.prepareDemoOrder(orderId);
    }

    @PostMapping("/{orderId}/ready-to-ship")
    public SupplierOrderDto readyToShip(@PathVariable Long orderId) {
        return supplierOrderService.readyToShipDemoOrder(orderId);
    }

    @PostMapping("/{orderId}/start-shipping")
    public SupplierOrderDto startShipping(@PathVariable Long orderId) {
        return supplierOrderService.startShippingDemoOrder(orderId);
    }

    @PostMapping("/{orderId}/mark-delivered")
    public SupplierOrderDto markDelivered(@PathVariable Long orderId) {
        return supplierOrderService.markDeliveredDemoOrder(orderId);
    }

    @PostMapping("/{orderId}/sync-ghn")
    public SupplierOrderDto syncGhn(@PathVariable Long orderId) {
        return supplierOrderService.syncGhnDemoOrder(orderId);
    }

    @PatchMapping("/shipments/{shipmentId}/incidents/{incidentId}")
    public void updateShipmentIncident(
            @PathVariable Long shipmentId,
            @PathVariable Long incidentId,
            @RequestBody SupplierShipmentIncidentActionDto request) {
        supplierOrderService.updateShipmentIncident(shipmentId, incidentId, request);
    }
}
