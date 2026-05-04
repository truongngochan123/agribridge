package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerDeliveryDtos;
import java.time.LocalDate;
import java.util.List;

public interface BuyerDeliveryService {

    List<BuyerDeliveryDtos.ListItem> getDeliveries(Long branchId, String status, String keyword, LocalDate fromDate, LocalDate toDate);

    BuyerDeliveryDtos.Detail getDelivery(Long shipmentId);

    List<BuyerDeliveryDtos.TimelineEvent> getTimeline(Long shipmentId);

    BuyerDeliveryDtos.Detail confirmReceived(Long shipmentId, BuyerDeliveryDtos.ConfirmReceivedRequest request);

    BuyerDeliveryDtos.Incident createIncident(Long shipmentId, BuyerDeliveryDtos.IncidentRequest request);
}
