package com.agribridge.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "rfq_messages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RfqMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rfq_id", nullable = false)
    private Long rfqId;

    @Column(name = "sender_user_id", nullable = false)
    private Long senderUserId;

    @Column(name = "sender_company_id", nullable = false)
    private Long senderCompanyId;

    @Column(name = "sender_role", nullable = false, columnDefinition = "nvarchar(20)")
    private String senderRole;

    @Column(name = "message", nullable = false, columnDefinition = "nvarchar(max)")
    private String message;

    @Column(name = "created_at", nullable = false, columnDefinition = "datetime2 default GETDATE()")
    private LocalDateTime createdAt;
}
