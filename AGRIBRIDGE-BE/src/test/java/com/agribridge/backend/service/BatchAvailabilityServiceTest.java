package com.agribridge.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class BatchAvailabilityServiceTest {

    private final BatchAvailabilityService service = new BatchAvailabilityService();

    @Test
    void validAvailableBatchIsBuyerVisibleAndOrderable() {
        BatchEntity batch = batch(BatchStatusEnum.AVAILABLE, "20", LocalDate.now().plusDays(1));

        assertThat(service.isBuyerVisible(batch, approvedSupplier())).isTrue();
        service.validateOrderable(batch, 10L, new BigDecimal("5"));
    }

    @Test
    void validLowStockBatchIsBuyerVisibleAndOrderable() {
        BatchEntity batch = batch(BatchStatusEnum.LOW_STOCK, "3", LocalDate.now());

        assertThat(service.isBuyerVisible(batch, approvedSupplier())).isTrue();
        service.validateOrderable(batch, 10L, new BigDecimal("3"));
    }

    @Test
    void expiredBatchIsHiddenAndRejectedForOrders() {
        BatchEntity batch = batch(BatchStatusEnum.AVAILABLE, "20", LocalDate.now().minusDays(1));

        assertThat(service.isBuyerVisible(batch, approvedSupplier())).isFalse();
        assertThatThrownBy(() -> service.validateOrderable(batch, 10L, BigDecimal.ONE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(BatchAvailabilityService.UNAVAILABLE_MESSAGE);
    }

    @Test
    void missingExpiryOrQuantityBlocksBuyerVisibility() {
        assertThat(service.isBuyerVisible(batch(BatchStatusEnum.AVAILABLE, "0", LocalDate.now()), approvedSupplier()))
                .isFalse();
        assertThat(service.isBuyerVisible(batch(BatchStatusEnum.AVAILABLE, "5", null), approvedSupplier()))
                .isFalse();
    }

    @Test
    void unapprovedSupplierBlocksBuyerVisibility() {
        BatchEntity batch = batch(BatchStatusEnum.AVAILABLE, "20", LocalDate.now().plusDays(1));
        CompanyEntity supplier = CompanyEntity.builder()
                .verifiedStatus(false)
                .verificationStatus(VerificationStatusEnum.PENDING)
                .build();

        assertThat(service.isBuyerVisible(batch, supplier)).isFalse();
    }

    @Test
    void wrongProductOrInsufficientQuantityIsRejected() {
        BatchEntity batch = batch(BatchStatusEnum.AVAILABLE, "2", LocalDate.now().plusDays(1));

        assertThatThrownBy(() -> service.validateOrderable(batch, 99L, BigDecimal.ONE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(BatchAvailabilityService.UNAVAILABLE_MESSAGE);
        assertThatThrownBy(() -> service.validateOrderable(batch, 10L, new BigDecimal("3")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(BatchAvailabilityService.UNAVAILABLE_MESSAGE);
    }

    private BatchEntity batch(BatchStatusEnum status, String quantity, LocalDate expiryDate) {
        return BatchEntity.builder()
                .id(1L)
                .productId(10L)
                .status(status)
                .quantity(new BigDecimal(quantity))
                .expiryDate(expiryDate)
                .build();
    }

    private CompanyEntity approvedSupplier() {
        return CompanyEntity.builder()
                .verifiedStatus(true)
                .verificationStatus(VerificationStatusEnum.APPROVED)
                .build();
    }
}
