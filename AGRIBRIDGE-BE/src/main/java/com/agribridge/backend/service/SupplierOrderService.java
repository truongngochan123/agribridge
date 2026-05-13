package com.agribridge.backend.service;

import com.agribridge.backend.dto.CreateSupplierShipmentDto;
import com.agribridge.backend.dto.SupplierOrderDetailDto;
import com.agribridge.backend.dto.SupplierOrderDto;
import com.agribridge.backend.dto.UpdateSupplierOrderStatusDto;
import com.agribridge.backend.dto.UpdateSupplierShipmentStatusDto;
import java.util.List;

public interface SupplierOrderService {

    List<SupplierOrderDto> getSupplierOrders(Long supplierCompanyId);

    SupplierOrderDetailDto getSupplierOrderDetail(Long supplierCompanyId, Long orderId);

    SupplierOrderDto updateSupplierOrderStatus(Long supplierCompanyId, Long orderId, UpdateSupplierOrderStatusDto request);

    SupplierOrderDto createShipment(Long supplierCompanyId, Long orderId, CreateSupplierShipmentDto request);

    SupplierOrderDto updateShipmentStatus(Long supplierCompanyId, Long orderId, UpdateSupplierShipmentStatusDto request);

    SupplierOrderDto confirmDemoOrder(Long orderId);

    SupplierOrderDto prepareDemoOrder(Long orderId);

    SupplierOrderDto readyToShipDemoOrder(Long orderId);

    SupplierOrderDto startShippingDemoOrder(Long orderId);

    SupplierOrderDto markDeliveredDemoOrder(Long orderId);

    SupplierOrderDto syncGhnDemoOrder(Long orderId);
}
