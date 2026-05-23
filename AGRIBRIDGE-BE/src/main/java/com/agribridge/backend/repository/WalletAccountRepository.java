package com.agribridge.backend.repository;

import com.agribridge.backend.entity.WalletAccountEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletAccountRepository extends JpaRepository<WalletAccountEntity, Long> {
    Optional<WalletAccountEntity> findByCompanyId(Long companyId);
}
