package com.agribridge.backend.repository;

import com.agribridge.backend.entity.PaymentAllocationEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocationEntity, Long> {

    List<PaymentAllocationEntity> findByInvoiceIdIn(Collection<Long> invoiceIds);

    List<PaymentAllocationEntity> findByPaymentIdIn(Collection<Long> paymentIds);
}
