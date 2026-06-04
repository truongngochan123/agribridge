package com.agribridge.backend.entity;

import com.agribridge.backend.entity.enums.ShipmentStatusEnum;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shipments")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShipmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "parent_shipment_id")
    private Long parentShipmentId;

    @Column(name = "shipment_type")
    private String shipmentType;

    @Column(name = "replacement_incident_id")
    private Long replacementIncidentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", insertable = false, updatable = false)
    private OrderEntity order;

    @Column(name = "carrier_name")
    private String carrierName;

    @Column(name = "provider_code")
    private String providerCode;

    @Column(name = "provider_name")
    private String providerName;

    @Column(name = "service_name")
    private String serviceName;

    @Column(name = "receiver_name")
    private String receiverName;

    @Column(name = "receiver_phone")
    private String receiverPhone;

    @Column(name = "receiver_province")
    private String receiverProvince;

    @Column(name = "receiver_district")
    private String receiverDistrict;

    @Column(name = "receiver_ward")
    private String receiverWard;

    @Column(name = "receiver_address")
    private String receiverAddress;

    @Column(name = "vehicle_info")
    private String vehicleInfo;

    @Column(name = "driver_name")
    private String driverName;

    @Column(name = "driver_phone")
    private String driverPhone;

    @Column(name = "tracking_code")
    private String trackingCode;

    @Column(name = "ghn_order_code")
    private String ghnOrderCode;

    @Column(name = "ghn_sort_code")
    private String ghnSortCode;

    @Column(name = "ghn_trans_type")
    private String ghnTransType;

    @Column(name = "ghn_raw_response", columnDefinition = "NVARCHAR(MAX)")
    private String ghnRawResponse;

    @Column(name = "shipping_method")
    private String shippingMethod;

    @Column(name = "quote_status")
    private String quoteStatus;

    @Column(name = "estimated_delivery_time")
    private String estimatedDeliveryTime;

    @Column(name = "estimated_delivery_at")
    private LocalDateTime estimatedDeliveryAt;

    @Column(name = "expected_delivery_date")
    private LocalDateTime expectedDeliveryDate;

    @Column(name = "current_location")
    private String currentLocation;

    @Column(name = "current_lat")
    private BigDecimal currentLat;

    @Column(name = "current_lng")
    private BigDecimal currentLng;

    @Column(name = "shipping_payer")
    private String shippingPayer;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ShipmentStatusEnum status;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "confirmed_received_at")
    private LocalDateTime confirmedReceivedAt;

    @Column(name = "confirmed_received_by_user_id")
    private Long confirmedReceivedByUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_received_by_user_id", insertable = false, updatable = false)
    private UserEntity confirmedReceivedByUser;

    @Column(name = "shipping_fee")
    private BigDecimal shippingFee;

    @Column(name = "weight")
    private Integer weight;

    @Column(name = "length")
    private Integer length;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "shop_id_used")
    private String shopIdUsed;

    @Column(name = "from_district_id")
    private Integer fromDistrictId;

    @Column(name = "from_ward_code")
    private String fromWardCode;

    @Column(name = "to_district_id")
    private Integer toDistrictId;

    @Column(name = "to_ward_code")
    private String toWardCode;

    @Column(name = "service_type_id")
    private Integer serviceTypeId;

    @Column(name = "service_id")
    private Integer serviceId;

    @Column(name = "insurance_value")
    private BigDecimal insuranceValue;

    @Column(name = "raw_quote_request", columnDefinition = "NVARCHAR(MAX)")
    private String rawQuoteRequest;

    @Column(name = "raw_quote_response", columnDefinition = "NVARCHAR(MAX)")
    private String rawQuoteResponse;

    @Column(name = "quoted_shipping_fee")
    private BigDecimal quotedShippingFee;

    @Column(name = "ghn_create_fee")
    private BigDecimal ghnCreateFee;

    @Column(name = "sender_address_source")
    private String senderAddressSource;

    @Column(name = "shipping_fee_source")
    private String shippingFeeSource;

    @Column(name = "auto_progress_enabled", nullable = false)
    private Boolean autoProgressEnabled;

    @Column(name = "demo_tracking_enabled", nullable = false)
    private Boolean demoTrackingEnabled;

    @Column(name = "last_status_changed_at")
    private LocalDateTime lastStatusChangedAt;

    @Column(name = "progress")
    private Integer progress;

    @Column(name = "fee_confirmed", nullable = false)
    private Boolean feeConfirmed;

    @Column(name = "incident_note", columnDefinition = "NVARCHAR(MAX)")
    private String incidentNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
