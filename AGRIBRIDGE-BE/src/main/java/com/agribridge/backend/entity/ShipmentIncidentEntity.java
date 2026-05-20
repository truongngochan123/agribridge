package com.agribridge.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shipment_incidents")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShipmentIncidentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "shipment_id", nullable = false)
    private Long shipmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id", insertable = false, updatable = false)
    private ShipmentEntity shipment;

    @Column(name = "reported_by_user_id", nullable = false)
    private Long reportedByUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_user_id", insertable = false, updatable = false)
    private UserEntity reportedByUser;

    @Column(name = "incident_type", nullable = false)
    private String incidentType;

    @Column(name = "description", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String description;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private String status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_note")
    private String resolutionNote;

    @Column(name = "missing_quantity")
    private Integer missingQuantity;

    @Column(name = "damaged_quantity")
    private Integer damagedQuantity;

    @Column(name = "update_note", columnDefinition = "NVARCHAR(MAX)")
    private String updateNote;

    /** JSON array of evidence image URLs (comma-separated for simplicity) */
    @Column(name = "evidence_urls", columnDefinition = "NVARCHAR(MAX)")
    private String evidenceUrls;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "supplier_response", columnDefinition = "NVARCHAR(MAX)")
    private String supplierResponse;

    @Column(name = "supplier_evidence_urls", columnDefinition = "NVARCHAR(MAX)")
    private String supplierEvidenceUrls;

    @Column(name = "proposed_resolution", columnDefinition = "NVARCHAR(MAX)")
    private String proposedResolution;

    @Column(name = "resolution_type")
    private String resolutionType;

    @Column(name = "buyer_action_required_at")
    private LocalDateTime buyerActionRequiredAt;
}
