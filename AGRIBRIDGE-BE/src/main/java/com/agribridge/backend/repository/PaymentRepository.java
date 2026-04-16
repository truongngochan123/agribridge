package com.agribridge.backend.repository;

import com.agribridge.backend.entity.PaymentEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Long> {

    List<PaymentEntity> findByInvoiceIdInOrderByPaymentDateDesc(Collection<Long> invoiceIds);
}
