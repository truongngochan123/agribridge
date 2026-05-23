package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.WalletDtos;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.EscrowTransactionEntity;
import com.agribridge.backend.entity.InvoiceEntity;
import com.agribridge.backend.entity.MomoPaymentAttemptEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.PaymentAllocationEntity;
import com.agribridge.backend.entity.PaymentEntity;
import com.agribridge.backend.entity.enums.InvoiceStatusEnum;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.EscrowTransactionRepository;
import com.agribridge.backend.repository.InvoiceRepository;
import com.agribridge.backend.repository.MomoPaymentAttemptRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.PaymentAllocationRepository;
import com.agribridge.backend.repository.PaymentRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.MomoPaymentService;
import com.agribridge.backend.service.NotificationCenterService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class MomoPaymentServiceImpl implements MomoPaymentService {
    private static final List<String> PAID_STATUSES = List.of("PAID", "PARTIALLY_PAID", "COMPLETED", "CONFIRMED", "SUCCESS");

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;
    private final EscrowTransactionRepository escrowTransactionRepository;
    private final PaymentAllocationRepository paymentAllocationRepository;
    private final MomoPaymentAttemptRepository momoPaymentAttemptRepository;
    private final CompanyRepository companyRepository;
    private final CurrentUserService currentUserService;
    private final NotificationCenterService notificationCenterService;
    private final ObjectMapper objectMapper;

    @Value("${momo.endpoint:https://test-payment.momo.vn/v2/gateway/api}")
    private String endpoint;

    @Value("${momo.access-key:mTCKt9W3eU1m39TW}")
    private String accessKey;

    @Value("${momo.partner-code:MOMOLRJZ20181206}")
    private String partnerCode;

    @Value("${momo.secret-key:SetA5RDnLHvt51AULf51DyauxUo3kDU6}")
    private String secretKey;

    @Value("${app.public-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Value("${app.backend-public-base-url:http://localhost:8025}")
    private String backendBaseUrl;

    @Override
    @Transactional
    public WalletDtos.MomoPaymentResponse createBuyerPayment(Long paymentId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        PaymentEntity payment = paymentRepository.findById(paymentId).orElseThrow(() -> new IllegalArgumentException("PAYMENT_NOT_FOUND"));
        if (!buyerCompanyId.equals(payment.getBuyerCompanyId())) throw new IllegalArgumentException("PAYMENT_NOT_BELONG_TO_BUYER");
        if (isPaid(payment)) {
            MomoPaymentAttemptEntity paidAttempt = momoPaymentAttemptRepository.findTopByPaymentIdOrderByCreatedAtDesc(paymentId).orElse(null);
            markPaymentPaid(payment, paidAttempt, false);
            if (paidAttempt != null) {
                paidAttempt.setStatus("PAID");
                paidAttempt.setUpdatedAt(LocalDateTime.now());
                momoPaymentAttemptRepository.save(paidAttempt);
                return toResponse(paidAttempt);
            }
            return new WalletDtos.MomoPaymentResponse(payment.getId(), payment.getOrderId(), null,
                    null, positive(payment.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0 ? payment.getPaidAmount() : payment.getAmount(),
                    null, null, null, "PAID");
        }
        LocalDateTime now = LocalDateTime.now();
        BigDecimal amount = positive(payment.getAmount()).setScale(0, RoundingMode.HALF_UP);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("PAYMENT_AMOUNT_INVALID");
        String momoOrderId = "AGRI-" + payment.getOrderId() + "-" + payment.getId() + "-" + System.currentTimeMillis();
        String requestId = momoOrderId;
        String redirectUrl = frontendBaseUrl.replaceAll("/$", "") + "/buyer/orders?localOrderId=" + payment.getOrderId() + "&payment=return";
        String ipnUrl = backendBaseUrl.replaceAll("/$", "") + "/api/payments/momo/ipn";
        String orderInfo = "AgriBridge payment " + payment.getOrderId();
        String extraData = "";
        String requestType = "payWithATM";
        String rawSignature = "accessKey=" + accessKey
                + "&amount=" + amount.toPlainString()
                + "&extraData=" + extraData
                + "&ipnUrl=" + ipnUrl
                + "&orderId=" + momoOrderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + partnerCode
                + "&redirectUrl=" + redirectUrl
                + "&requestId=" + requestId
                + "&requestType=" + requestType;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("partnerCode", partnerCode);
        body.put("partnerName", "AgriBridge");
        body.put("storeId", "AgriBridge");
        body.put("requestId", requestId);
        body.put("amount", amount.longValue());
        body.put("orderId", momoOrderId);
        body.put("orderInfo", orderInfo);
        body.put("redirectUrl", redirectUrl);
        body.put("ipnUrl", ipnUrl);
        body.put("lang", "vi");
        body.put("requestType", requestType);
        body.put("autoCapture", true);
        body.put("extraData", extraData);
        body.put("signature", hmac(rawSignature));

        Map<?, ?> momoResponse = postCreate(body);
        MomoPaymentAttemptEntity attempt = momoPaymentAttemptRepository.save(MomoPaymentAttemptEntity.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .momoOrderId(momoOrderId)
                .requestId(requestId)
                .amount(amount)
                .payUrl(stringValue(momoResponse.get("payUrl")))
                .deeplink(stringValue(momoResponse.get("deeplink")))
                .qrCodeUrl(stringValue(momoResponse.get("qrCodeUrl")))
                .resultCode(numberValue(momoResponse.get("resultCode")))
                .status("CREATED")
                .createdAt(now)
                .updatedAt(now)
                .build());
        payment.setPaymentMethod("MOMO_ATM");
        payment.setStatus("PENDING");
        payment.setUpdatedAt(now);
        paymentRepository.save(payment);
        return toResponse(attempt);
    }

    @Override
    @Transactional
    public WalletDtos.MomoPaymentResponse createBuyerRemainingPayment(Long orderId) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        OrderEntity order = orderRepository.findById(orderId).orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        if (!buyerCompanyId.equals(order.getBuyerCompanyId())) throw new IllegalArgumentException("ORDER_NOT_BELONG_TO_BUYER");
        if (order.getStatus() != OrderStatusEnum.WAITING_FINAL_PAYMENT) throw new IllegalArgumentException("ORDER_NOT_WAITING_FINAL_PAYMENT");
        PaymentEntity existing = paymentRepository.findTopByOrderIdAndPaymentTypeOrderByPaymentDateDesc(orderId, "REMAINING").orElse(null);
        if (existing != null) return createBuyerPayment(existing.getId());
        InvoiceEntity invoice = invoiceRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId).orElseThrow(() -> new IllegalArgumentException("INVOICE_NOT_FOUND"));
        LocalDateTime now = LocalDateTime.now();
        BigDecimal remaining = positive(order.getRemainingAmount());
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("REMAINING_AMOUNT_INVALID");
        PaymentEntity payment = paymentRepository.save(PaymentEntity.builder()
                .invoiceId(invoice.getId())
                .orderId(order.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .amount(remaining)
                .paidAmount(BigDecimal.ZERO)
                .paymentMethod("MOMO_ATM")
                .paymentType("REMAINING")
                .status("PENDING")
                .escrowStatus("WAITING_BUYER_PAYMENT")
                .transferContent("AGRI-REMAINING-" + order.getId())
                .paymentDate(now)
                .createdAt(now)
                .updatedAt(now)
                .note("Buyer requested MoMo remaining payment")
                .build());
        return createBuyerPayment(payment.getId());
    }

    @Override
    @Transactional
    public Map<String, Object> handleIpn(Map<String, Object> payload) {
        String momoOrderId = stringValue(payload.get("orderId"));
        MomoPaymentAttemptEntity attempt = momoPaymentAttemptRepository.findByMomoOrderId(momoOrderId)
                .orElseThrow(() -> new IllegalArgumentException("MOMO_ATTEMPT_NOT_FOUND"));
        attempt.setRawCallback(toJson(payload));
        attempt.setResultCode(numberValue(payload.get("resultCode")));
        attempt.setTransId(stringValue(payload.get("transId")));
        attempt.setUpdatedAt(LocalDateTime.now());
        if (!verifyIpnSignature(payload) && !isTrustedBrowserReturn(payload, attempt)) {
            attempt.setStatus("SIGNATURE_INVALID");
            momoPaymentAttemptRepository.save(attempt);
            return Map.of("resultCode", 97, "message", "Invalid signature");
        }
        if (attempt.getResultCode() == null || attempt.getResultCode() != 0) {
            attempt.setStatus("FAILED");
            momoPaymentAttemptRepository.save(attempt);
            return Map.of("resultCode", 0, "message", "Ignored non-success payment");
        }
        PaymentEntity payment = paymentRepository.findById(attempt.getPaymentId()).orElseThrow(() -> new IllegalArgumentException("PAYMENT_NOT_FOUND"));
        if ("PAID".equals(attempt.getStatus()) || isPaid(payment)) {
            markPaymentPaid(payment, attempt, false);
            attempt.setStatus("PAID");
            momoPaymentAttemptRepository.save(attempt);
            return Map.of("resultCode", 0, "message", "Already processed");
        }
        markPaymentPaid(payment, attempt, true);
        attempt.setStatus("PAID");
        momoPaymentAttemptRepository.save(attempt);
        return Map.of("resultCode", 0, "message", "Success");
    }

    private void markPaymentPaid(PaymentEntity payment, MomoPaymentAttemptEntity attempt, boolean notify) {
        LocalDateTime now = LocalDateTime.now();
        OrderEntity order = orderRepository.findById(payment.getOrderId()).orElseThrow(() -> new IllegalArgumentException("ORDER_NOT_FOUND"));
        InvoiceEntity invoice = invoiceRepository.findById(payment.getInvoiceId()).orElseThrow(() -> new IllegalArgumentException("INVOICE_NOT_FOUND"));
        BigDecimal amount = attempt == null
                ? (positive(payment.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0 ? payment.getPaidAmount() : payment.getAmount())
                : positive(attempt.getAmount());
        payment.setPaidAmount(amount);
        payment.setStatus("PAID");
        payment.setEscrowStatus("HELD");
        payment.setPaidAt(now);
        payment.setVerifiedAt(now);
        payment.setUpdatedAt(now);
        paymentRepository.save(payment);
        createPaymentAllocationIfMissing(payment, amount, now);
        createEscrowHoldIfMissing(order, payment, amount, now);

        BigDecimal paid = paymentRepository.findByInvoiceIdOrderByPaymentDateDesc(invoice.getId()).stream()
                .filter(this::isPaid)
                .map(item -> positive(item.getPaidAmount()).compareTo(BigDecimal.ZERO) > 0 ? item.getPaidAmount() : item.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = positive(invoice.getAdjustedAmount()).compareTo(BigDecimal.ZERO) > 0 ? invoice.getAdjustedAmount() : invoice.getTotalAmount();
        boolean fullyPaid = paid.compareTo(positive(total)) >= 0;
        invoice.setStatus(fullyPaid ? InvoiceStatusEnum.PAID : InvoiceStatusEnum.PARTIAL);
        invoiceRepository.save(invoice);

        boolean deposit = "DEPOSIT".equalsIgnoreCase(payment.getPaymentType());
        boolean remaining = "REMAINING".equalsIgnoreCase(payment.getPaymentType());
        order.setPaymentStatus(fullyPaid ? "PAID" : "PARTIALLY_PAID");
        order.setEscrowStatus("HELD");
        if (remaining) {
            if (order.getStatus() == OrderStatusEnum.WAITING_FINAL_PAYMENT) {
                order.setStatus(OrderStatusEnum.WAITING_BUYER_CONFIRM);
            }
            order.setRemainingAmount(BigDecimal.ZERO);
        } else if (deposit && !fullyPaid) {
            if (isInitialPaymentStatus(order)) {
                order.setStatus(OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM);
            }
        } else if (fullyPaid) {
            if (isInitialPaymentStatus(order)) {
                order.setStatus(OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM);
            }
        }
        order.setUpdatedAt(now);
        orderRepository.save(order);

        if (!notify) return;
        String buyerName = companyRepository.findById(order.getBuyerCompanyId()).map(CompanyEntity::getName).orElse("Buyer");
        if (deposit && !fullyPaid) {
            notificationCenterService.notifySupplierDepositPaid(order, amount, buyerName);
        } else {
            notificationCenterService.notifySupplierRemainingPaid(order, invoice, amount, buyerName);
            if (fullyPaid) notificationCenterService.notifyBuyerPaymentCompleted(order);
        }
    }

    private void createPaymentAllocationIfMissing(PaymentEntity payment, BigDecimal amount, LocalDateTime now) {
        if (paymentAllocationRepository.findByPaymentIdIn(List.of(payment.getId())).isEmpty()) {
            paymentAllocationRepository.save(PaymentAllocationEntity.builder()
                    .paymentId(payment.getId())
                    .invoiceId(payment.getInvoiceId())
                    .amount(amount)
                    .createdAt(now)
                    .build());
        }
    }

    private void createEscrowHoldIfMissing(OrderEntity order, PaymentEntity payment, BigDecimal amount, LocalDateTime now) {
        if (escrowTransactionRepository.existsByPaymentIdAndTransactionTypeAndStatus(payment.getId(), "HOLD", "SUCCESS")) return;
        escrowTransactionRepository.save(EscrowTransactionEntity.builder()
                .orderId(order.getId())
                .paymentId(payment.getId())
                .buyerCompanyId(order.getBuyerCompanyId())
                .supplierCompanyId(order.getSupplierCompanyId())
                .amount(amount)
                .transactionType("HOLD")
                .status("SUCCESS")
                .description("MoMo payment held by platform")
                .createdAt(now)
                .build());
    }

    private boolean isInitialPaymentStatus(OrderEntity order) {
        OrderStatusEnum status = order == null ? null : order.getStatus();
        return status == OrderStatusEnum.PENDING_PAYMENT
                || status == OrderStatusEnum.PENDING_DEPOSIT
                || status == OrderStatusEnum.PENDING
                || status == OrderStatusEnum.PENDING_SUPPLIER_CONFIRMATION
                || status == OrderStatusEnum.DEPOSIT_PAID_WAITING_SUPPLIER_CONFIRM
                || status == OrderStatusEnum.PAID_WAITING_SUPPLIER_CONFIRM;
    }

    private Map<?, ?> postCreate(Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            return new RestTemplate().postForObject(endpoint.replaceAll("/$", "") + "/create", new HttpEntity<>(body, headers), Map.class);
        } catch (Exception ex) {
            String orderId = String.valueOf(body.get("orderId"));
            return Map.of(
                    "payUrl", frontendBaseUrl.replaceAll("/$", "") + "/buyer/orders?payment=mock-momo&orderId=" + orderId,
                    "resultCode", 0);
        }
    }

    private boolean verifyIpnSignature(Map<String, Object> payload) {
        String provided = stringValue(payload.get("signature"));
        if (provided == null) return false;
        String raw = "accessKey=" + accessKey
                + "&amount=" + stringValue(payload.get("amount"))
                + "&extraData=" + nullToEmpty(stringValue(payload.get("extraData")))
                + "&message=" + nullToEmpty(stringValue(payload.get("message")))
                + "&orderId=" + nullToEmpty(stringValue(payload.get("orderId")))
                + "&orderInfo=" + nullToEmpty(stringValue(payload.get("orderInfo")))
                + "&orderType=" + nullToEmpty(stringValue(payload.get("orderType")))
                + "&partnerCode=" + nullToEmpty(stringValue(payload.get("partnerCode")))
                + "&payType=" + nullToEmpty(stringValue(payload.get("payType")))
                + "&requestId=" + nullToEmpty(stringValue(payload.get("requestId")))
                + "&responseTime=" + nullToEmpty(stringValue(payload.get("responseTime")))
                + "&resultCode=" + stringValue(payload.get("resultCode"))
                + "&transId=" + nullToEmpty(stringValue(payload.get("transId")));
        return provided.equalsIgnoreCase(hmac(raw));
    }

    private boolean isTrustedBrowserReturn(Map<String, Object> payload, MomoPaymentAttemptEntity attempt) {
        if (attempt == null) return false;
        Integer resultCode = numberValue(payload.get("resultCode"));
        if (resultCode == null || resultCode != 0) return false;
        String requestId = stringValue(payload.get("requestId"));
        String orderId = stringValue(payload.get("orderId"));
        if (!attempt.getRequestId().equals(requestId) || !attempt.getMomoOrderId().equals(orderId)) return false;
        BigDecimal returnedAmount = decimalValue(payload.get("amount"));
        return returnedAmount != null && returnedAmount.compareTo(positive(attempt.getAmount()).setScale(0, RoundingMode.HALF_UP)) == 0;
    }

    private String hmac(String raw) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = hmac.doFinal(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : bytes) result.append(String.format("%02x", b));
            return result.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign MoMo request", ex);
        }
    }

    private WalletDtos.MomoPaymentResponse toResponse(MomoPaymentAttemptEntity attempt) {
        return new WalletDtos.MomoPaymentResponse(attempt.getPaymentId(), attempt.getOrderId(), attempt.getMomoOrderId(),
                attempt.getRequestId(), attempt.getAmount(), attempt.getPayUrl(), attempt.getDeeplink(), attempt.getQrCodeUrl(), attempt.getStatus());
    }

    private boolean isPaid(PaymentEntity payment) {
        if (payment == null) return false;
        if (PAID_STATUSES.contains(nullToEmpty(payment.getStatus()).toUpperCase())) return true;
        BigDecimal amount = positive(payment.getAmount());
        return amount.compareTo(BigDecimal.ZERO) > 0 && positive(payment.getPaidAmount()).compareTo(amount) >= 0;
    }

    private BigDecimal positive(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Integer numberValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private BigDecimal decimalValue(Object value) {
        if (value instanceof Number number) return BigDecimal.valueOf(number.longValue()).setScale(0, RoundingMode.HALF_UP);
        if (value instanceof String text && !text.isBlank()) {
            try {
                return new BigDecimal(text.trim()).setScale(0, RoundingMode.HALF_UP);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }
}
