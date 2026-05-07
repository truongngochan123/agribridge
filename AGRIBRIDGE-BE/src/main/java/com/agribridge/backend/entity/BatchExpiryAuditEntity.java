package com.agribridge.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "batch_expiry_audits")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchExpiryAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "old_expiry_date")
    private LocalDate oldExpiryDate;

    @Column(name = "new_expiry_date")
    private LocalDate newExpiryDate;

    @Column(name = "changed_by_user_id")
    private Long changedByUserId;

    @Column(length = 1000)
    private String reason;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    @Column(name = "approved_by_user_id")
    private Long approvedByUserId;
}
