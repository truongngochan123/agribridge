package com.agribridge.backend.repository;

import com.agribridge.backend.entity.WalletLedgerEntryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletLedgerEntryRepository extends JpaRepository<WalletLedgerEntryEntity, Long> {
    List<WalletLedgerEntryEntity> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    boolean existsByOrderIdAndEntryType(Long orderId, String entryType);
}
