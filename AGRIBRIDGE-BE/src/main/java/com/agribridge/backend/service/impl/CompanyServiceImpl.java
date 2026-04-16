package com.agribridge.backend.service.impl;

import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.service.CompanyService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;

    @Override
    public List<CompanyEntity> findAll() {
        log.info("Fetching all companies");
        List<CompanyEntity> companies = companyRepository.findAll();
        log.info("Fetched {} companies", companies.size());
        return companies;
    }

    @Override
    public CompanyEntity findById(Long id) {
        log.info("Fetching company by id={}", id);
        CompanyEntity company = Objects.requireNonNull(companyRepository.findById(Objects.requireNonNull(id))
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + id)));
        log.info("Fetched company id={} type={}", company.getId(), company.getCompanyType());
        return company;
    }

    @Override
    public CompanyEntity create(CompanyEntity company) {
        log.info("Creating company name={} type={}",
                company == null ? null : company.getName(),
                company == null ? null : company.getCompanyType());
        CompanyEntity safeCompany = Objects.requireNonNull(company);
        safeCompany.setId(null);
        if (safeCompany.getVerificationStatus() == null) {
            safeCompany.setVerificationStatus(VerificationStatusEnum.PENDING);
        }
        if (safeCompany.getVerifiedStatus() == null) {
            safeCompany.setVerifiedStatus(false);
        }
        CompanyEntity createdCompany = Objects.requireNonNull(companyRepository.save(safeCompany));
        log.info("Created company id={} verificationStatus={}", createdCompany.getId(), createdCompany.getVerificationStatus());
        return createdCompany;
    }

    @Override
    public CompanyEntity update(Long id, CompanyEntity company) {
        log.info("Updating company id={}", id);
        CompanyEntity existing = findById(id);
        BeanUtils.copyProperties(Objects.requireNonNull(company), Objects.requireNonNull(existing), "id", "createdAt");
        CompanyEntity updatedCompany = Objects.requireNonNull(companyRepository.save(existing));
        log.info("Updated company id={} verificationStatus={}", updatedCompany.getId(), updatedCompany.getVerificationStatus());
        return updatedCompany;
    }

    @Override
    public void delete(Long id) {
        log.info("Deleting company id={}", id);
        CompanyEntity existing = findById(id);
        companyRepository.delete(Objects.requireNonNull(existing));
        log.info("Deleted company id={}", id);
    }

    @Override
    public CompanyEntity approveVerification(Long id, Long verifiedByUserId) {
        log.info("Approving company verification companyId={} verifiedByUserId={}", id, verifiedByUserId);
        CompanyEntity company = findById(id);
        company.setVerifiedStatus(true);
        company.setVerificationStatus(VerificationStatusEnum.APPROVED);
        company.setVerifiedAt(LocalDateTime.now());
        company.setVerifiedByUserId(Objects.requireNonNull(verifiedByUserId));
        CompanyEntity approvedCompany = Objects.requireNonNull(companyRepository.save(company));
        log.info("Approved company verification companyId={}", approvedCompany.getId());
        return approvedCompany;
    }
}
