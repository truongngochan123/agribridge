package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerDeliveryDtos;
import com.agribridge.backend.service.BuyerDeliveryService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/deliveries")
@RequiredArgsConstructor
public class BuyerDeliveryController {

    private final BuyerDeliveryService buyerDeliveryService;

    @GetMapping
    public List<BuyerDeliveryDtos.ListItem> getDeliveries(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return buyerDeliveryService.getDeliveries(branchId, status, keyword, fromDate, toDate);
    }

    @GetMapping("/{shipmentId}")
    public BuyerDeliveryDtos.Detail getDelivery(@PathVariable Long shipmentId) {
        return buyerDeliveryService.getDelivery(shipmentId);
    }

    @GetMapping("/{shipmentId}/timeline")
    public List<BuyerDeliveryDtos.TimelineEvent> getTimeline(@PathVariable Long shipmentId) {
        return buyerDeliveryService.getTimeline(shipmentId);
    }

    @PostMapping("/{shipmentId}/confirm-received")
    public BuyerDeliveryDtos.Detail confirmReceived(
            @PathVariable Long shipmentId,
            @RequestBody(required = false) BuyerDeliveryDtos.ConfirmReceivedRequest request) {
        return buyerDeliveryService.confirmReceived(shipmentId, request);
    }

    @PostMapping("/{shipmentId}/incidents")
    public BuyerDeliveryDtos.Incident createIncident(
            @PathVariable Long shipmentId,
            @RequestBody BuyerDeliveryDtos.IncidentRequest request) {
        return buyerDeliveryService.createIncident(shipmentId, request);
    }
}
