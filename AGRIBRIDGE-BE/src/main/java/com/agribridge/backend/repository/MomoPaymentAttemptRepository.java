package com.agribridge.backend.repository;

import com.agribridge.backend.entity.MomoPaymentAttemptEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MomoPaymentAttemptRepository extends JpaRepository<MomoPaymentAttemptEntity, Long> {
    Optional<MomoPaymentAttemptEntity> findByMomoOrderId(String momoOrderId);

    Optional<MomoPaymentAttemptEntity> findTopByPaymentIdAndStatusOrderByCreatedAtDesc(Long paymentId, String status);

    Optional<MomoPaymentAttemptEntity> findTopByPaymentIdOrderByCreatedAtDesc(Long paymentId);

    List<MomoPaymentAttemptEntity> findByOrderIdIn(Collection<Long> orderIds);
}
