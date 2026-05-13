package com.agribridge.backend.service;

import com.agribridge.backend.dto.CompanyProfileAssetsResponseDto;
import com.agribridge.backend.dto.UpdateCompanyLegalProfileDto;
import com.agribridge.backend.dto.UpsertCompanyImageDto;
import com.agribridge.backend.entity.CompanyEntity;
import java.util.List;

public interface CompanyService {
    List<CompanyEntity> findAll();

    CompanyEntity findById(Long id);

    CompanyEntity create(CompanyEntity company);

    CompanyEntity update(Long id, CompanyEntity company);

    CompanyEntity updateLegalProfile(Long id, UpdateCompanyLegalProfileDto request);

    CompanyEntity syncGhnShop(Long id);

    CompanyProfileAssetsResponseDto getProfileAssets(Long companyId);

    CompanyProfileAssetsResponseDto uploadLogo(Long companyId, UpsertCompanyImageDto request);

    CompanyProfileAssetsResponseDto removeLogo(Long companyId);

    CompanyProfileAssetsResponseDto addFarmImage(Long companyId, UpsertCompanyImageDto request);

    CompanyProfileAssetsResponseDto addCertificate(Long companyId, UpsertCompanyImageDto request);

    CompanyProfileAssetsResponseDto deleteMedia(Long companyId, Long mediaId);

    void delete(Long id);

    CompanyEntity approveVerification(Long id, Long verifiedByUserId);
}
