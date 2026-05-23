package com.agribridge.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "momo_payment_attempts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MomoPaymentAttemptEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_id", nullable = false)
    private Long paymentId;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "momo_order_id", nullable = false, unique = true)
    private String momoOrderId;

    @Column(name = "request_id", nullable = false)
    private String requestId;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "pay_url")
    private String payUrl;

    @Column(name = "deeplink")
    private String deeplink;

    @Column(name = "qr_code_url")
    private String qrCodeUrl;

    @Column(name = "result_code")
    private Integer resultCode;

    @Column(name = "trans_id")
    private String transId;

    @Column(name = "status", nullable = false)
    private String status;

    @Lob
    @Column(name = "raw_callback", columnDefinition = "NVARCHAR(MAX)")
    private String rawCallback;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
