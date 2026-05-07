package com.agribridge.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.repository.UserRepository.SupplierOwnerRef;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BatchExpiryJobTest {

    @Mock
    private BatchRepository batchRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Test
    void expireBatchesMarksExpiredBatchesAndNotifiesSupplierOwner() {
        BatchEntity batch = BatchEntity.builder()
                .id(101L)
                .productId(20L)
                .status(BatchStatusEnum.AVAILABLE)
                .quantity(new BigDecimal("50"))
                .expiryDate(LocalDate.now().minusDays(1))
                .build();
        ProductEntity product = ProductEntity.builder()
                .id(20L)
                .supplierCompanyId(7L)
                .name("Tom thep chan trang")
                .build();
        SupplierOwnerRef owner = supplierOwnerRef(900L, 7L);

        when(batchRepository.findExpiredPublicBatches(any())).thenReturn(List.of(batch));
        when(productRepository.findAllById(any())).thenReturn(List.of(product));
        when(userRepository.findSupplierOwnerRefsByCompanyIds(any())).thenReturn(List.of(owner));

        int updated = job().expireBatches("test");

        assertThat(updated).isEqualTo(1);
        assertThat(batch.getStatus()).isEqualTo(BatchStatusEnum.EXPIRED);
        verify(batchRepository).saveAll(List.of(batch));

        ArgumentCaptor<NotificationEntity> notificationCaptor = ArgumentCaptor.forClass(NotificationEntity.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        NotificationEntity notification = notificationCaptor.getValue();
        assertThat(notification.getUserId()).isEqualTo(900L);
        assertThat(notification.getCompanyId()).isEqualTo(7L);
        assertThat(notification.getRefTable()).isEqualTo("batches");
        assertThat(notification.getRefId()).isEqualTo(101L);
        assertThat(notification.getBody()).contains("101").contains("Tom thep chan trang");
    }

    @Test
    void expireBatchesDoesNothingWhenNoExpiredPublicBatchesExist() {
        when(batchRepository.findExpiredPublicBatches(any())).thenReturn(List.of());

        int updated = job().expireBatches("test");

        assertThat(updated).isZero();
        verify(batchRepository, never()).saveAll(any());
        verify(notificationRepository, never()).save(any());
    }

    private BatchExpiryJob job() {
        return new BatchExpiryJob(batchRepository, productRepository, userRepository, notificationRepository);
    }

    private SupplierOwnerRef supplierOwnerRef(Long id, Long companyId) {
        return new SupplierOwnerRef() {
            @Override
            public Long getId() {
                return id;
            }

            @Override
            public Long getCompanyId() {
                return companyId;
            }
        };
    }
}
