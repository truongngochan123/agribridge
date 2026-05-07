package com.agribridge.backend.service;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class BatchAvailabilityService {

    public static final String UNAVAILABLE_MESSAGE =
            "Lô hàng đã hết hạn hoặc không còn khả dụng. Vui lòng chọn lô hàng khác.";

    private static final Set<BatchStatusEnum> BUYER_ORDERABLE_STATUSES =
            EnumSet.of(BatchStatusEnum.AVAILABLE, BatchStatusEnum.LOW_STOCK);

    public boolean isBuyerVisible(BatchEntity batch) {
        return isBuyerVisible(batch, null);
    }

    public boolean isBuyerVisible(BatchEntity batch, CompanyEntity supplier) {
        return batch != null
                && BUYER_ORDERABLE_STATUSES.contains(batch.getStatus())
                && batch.getQuantity() != null
                && batch.getQuantity().compareTo(BigDecimal.ZERO) > 0
                && batch.getExpiryDate() != null
                && !batch.getExpiryDate().isBefore(LocalDate.now())
                && isSupplierApproved(supplier);
    }

    public void validateOrderable(BatchEntity batch, Long expectedProductId, BigDecimal requestedQuantity) {
        if (batch == null
                || !Objects.equals(batch.getProductId(), expectedProductId)
                || !isBuyerVisible(batch)
                || requestedQuantity == null
                || batch.getQuantity() == null
                || batch.getQuantity().compareTo(requestedQuantity) < 0) {
            throw new IllegalArgumentException(UNAVAILABLE_MESSAGE);
        }
    }

    public int daysUntilExpiry(BatchEntity batch) {
        if (batch == null || batch.getExpiryDate() == null) {
            return Integer.MAX_VALUE;
        }
        return (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), batch.getExpiryDate());
    }

    public boolean isExpired(BatchEntity batch) {
        return batch != null && batch.getExpiryDate() != null && batch.getExpiryDate().isBefore(LocalDate.now());
    }

    public boolean isSupplierApproved(CompanyEntity supplier) {
        return supplier == null
                || Boolean.TRUE.equals(supplier.getVerifiedStatus())
                || VerificationStatusEnum.APPROVED.equals(supplier.getVerificationStatus());
    }
}
