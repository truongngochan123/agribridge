package com.agribridge.backend.repository;

import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyRepository extends JpaRepository<CompanyEntity, Long> {

    List<CompanyEntity> findByVerifiedStatusFalseOrderByCreatedAtDesc();

    List<CompanyEntity> findAllByOrderByCreatedAtDesc();

    Optional<CompanyEntity> findFirstByCompanyTypeOrderByCreatedAtDesc(CompanyTypeEnum companyType);

    boolean existsByTaxCode(String taxCode);

    boolean existsByTaxCodeAndIdNot(String taxCode, Long id);

    boolean existsByCitizenId(String citizenId);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
}
