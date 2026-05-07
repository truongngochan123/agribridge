package com.agribridge.backend.service;

import com.agribridge.backend.entity.BatchEntity;
import com.agribridge.backend.entity.NotificationEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.enums.BatchStatusEnum;
import com.agribridge.backend.entity.enums.NotificationTypeEnum;
import com.agribridge.backend.repository.BatchRepository;
import com.agribridge.backend.repository.NotificationRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.repository.UserRepository.SupplierOwnerRef;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
@DependsOn("batchStatusConstraintFix")
public class BatchExpiryJob {

    private static final List<BatchStatusEnum> EXPIRABLE_STATUSES =
            List.of(BatchStatusEnum.AVAILABLE, BatchStatusEnum.LOW_STOCK);

    private final BatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    @PostConstruct
    @Transactional
    public void cleanupExistingExpiredBatchesOnStartup() {
        expireBatches("startup");
    }

    @Scheduled(cron = "0 10 0 * * *")
    @Transactional
    public void expireBatchesDaily() {
        expireBatches("daily");
    }

    public int expireBatches(String source) {
        List<BatchEntity> expiredBatches = batchRepository.findExpiredPublicBatches(EXPIRABLE_STATUSES);
        if (expiredBatches.isEmpty()) {
            log.info("Batch expiry job source={} found no expired public batches", source);
            return 0;
        }

        Map<Long, ProductEntity> productById = productRepository.findAllById(expiredBatches.stream()
                        .map(BatchEntity::getProductId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity(), (left, right) -> left));
        Map<Long, SupplierOwnerRef> ownerByCompanyId = loadSupplierOwners(productById.values());

        LocalDateTime now = LocalDateTime.now();
        for (BatchEntity batch : expiredBatches) {
            batch.setStatus(BatchStatusEnum.EXPIRED);
            ProductEntity product = productById.get(batch.getProductId());
            SupplierOwnerRef owner = product == null ? null : ownerByCompanyId.get(product.getSupplierCompanyId());
            if (product != null && owner != null) {
                notificationRepository.save(NotificationEntity.builder()
                        .userId(owner.getId())
                        .companyId(product.getSupplierCompanyId())
                        .type(NotificationTypeEnum.SYSTEM)
                        .title("Lô hàng đã hết hạn")
                        .body("Lô hàng " + batchLabel(batch, product) + " đã hết hạn và đã bị ẩn khỏi buyer.")
                        .refTable("batches")
                        .refId(batch.getId())
                        .isRead(false)
                        .createdAt(now)
                        .build());
            }
        }
        batchRepository.saveAll(expiredBatches);
        log.info("Batch expiry job source={} marked {} batch(es) as EXPIRED", source, expiredBatches.size());
        return expiredBatches.size();
    }

    private Map<Long, SupplierOwnerRef> loadSupplierOwners(Collection<ProductEntity> products) {
        Set<Long> supplierCompanyIds = products.stream()
                .map(ProductEntity::getSupplierCompanyId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (supplierCompanyIds.isEmpty()) {
            return Map.of();
        }
        return userRepository.findSupplierOwnerRefsByCompanyIds(supplierCompanyIds)
                .stream()
                .collect(Collectors.toMap(SupplierOwnerRef::getCompanyId, Function.identity(), (left, right) -> left));
    }

    private String batchLabel(BatchEntity batch, ProductEntity product) {
        String productName = product.getName() == null ? "N/A" : product.getName();
        return "[" + batch.getId() + "/" + productName + "]";
    }
}
