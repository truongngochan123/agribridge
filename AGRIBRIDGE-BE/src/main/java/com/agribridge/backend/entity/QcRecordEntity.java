package com.agribridge.backend.entity;

import com.agribridge.backend.entity.enums.QcResultEnum;
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
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "qc_records")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QcRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", insertable = false, updatable = false)
    private BatchEntity batch;

    @Column(name = "inspector_user_id", nullable = false)
    private Long inspectorUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspector_user_id", insertable = false, updatable = false)
    private UserEntity inspectorUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", nullable = false)
    private QcResultEnum result;

    @Column(name = "checklist", columnDefinition = "jsonb")
    private String checklist;

    @Column(name = "notes")
    private String notes;

    @Column(name = "document_url")
    private String documentUrl;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
