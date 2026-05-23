package com.agribridge.backend.repository;

import com.agribridge.backend.entity.EscrowTransactionEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EscrowTransactionRepository extends JpaRepository<EscrowTransactionEntity, Long> {

    List<EscrowTransactionEntity> findByOrderIdInOrderByCreatedAtAsc(Collection<Long> orderIds);

    List<EscrowTransactionEntity> findByOrderIdOrderByCreatedAtAsc(Long orderId);

    boolean existsByOrderIdAndTransactionTypeAndStatus(Long orderId, String transactionType, String status);

    boolean existsByPaymentIdAndTransactionTypeAndStatus(Long paymentId, String transactionType, String status);
}
