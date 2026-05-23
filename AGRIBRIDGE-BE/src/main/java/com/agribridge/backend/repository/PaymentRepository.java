package com.agribridge.backend.repository;

import com.agribridge.backend.entity.PaymentEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Long> {

    List<PaymentEntity> findByInvoiceIdInOrderByPaymentDateDesc(Collection<Long> invoiceIds);

    List<PaymentEntity> findByInvoiceIdOrderByPaymentDateDesc(Long invoiceId);

    List<PaymentEntity> findByOrderIdOrderByPaymentDateDesc(Long orderId);

    List<PaymentEntity> findByOrderIdInOrderByPaymentDateDesc(Collection<Long> orderIds);

    List<PaymentEntity> findByBuyerCompanyIdOrderByPaymentDateDesc(Long buyerCompanyId);

    Optional<PaymentEntity> findTopByOrderIdAndPaymentTypeOrderByPaymentDateDesc(Long orderId, String paymentType);
}
