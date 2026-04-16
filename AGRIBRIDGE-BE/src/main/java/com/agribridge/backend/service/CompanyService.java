package com.agribridge.backend.service;

import com.agribridge.backend.entity.CompanyEntity;
import java.util.List;

public interface CompanyService {
    List<CompanyEntity> findAll();

    CompanyEntity findById(Long id);

    CompanyEntity create(CompanyEntity company);

    CompanyEntity update(Long id, CompanyEntity company);

    void delete(Long id);

    CompanyEntity approveVerification(Long id, Long verifiedByUserId);
}
