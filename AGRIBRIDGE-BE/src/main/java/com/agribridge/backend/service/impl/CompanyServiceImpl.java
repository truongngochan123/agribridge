package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.CompanyProfileAssetsResponseDto;
import com.agribridge.backend.dto.UpdateCompanyLegalProfileDto;
import com.agribridge.backend.dto.UpsertCompanyImageDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.CompanyImageEntity;
import com.agribridge.backend.entity.enums.ImageTypeEnum;
import com.agribridge.backend.entity.enums.VerificationStatusEnum;
import com.agribridge.backend.repository.CompanyImageRepository;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.service.CompanyService;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyServiceImpl implements CompanyService {

    private final CompanyRepository companyRepository;
    private final CompanyImageRepository companyImageRepository;

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
        log.info("Created company id={} verificationStatus={}", createdCompany.getId(),
                createdCompany.getVerificationStatus());
        return createdCompany;
    }

    @Override
    public CompanyEntity update(Long id, CompanyEntity company) {
        log.info("Updating company id={}", id);
        CompanyEntity existing = findById(id);
        BeanUtils.copyProperties(Objects.requireNonNull(company), Objects.requireNonNull(existing), "id", "createdAt");
        CompanyEntity updatedCompany = Objects.requireNonNull(companyRepository.save(existing));
        log.info("Updated company id={} verificationStatus={}", updatedCompany.getId(),
                updatedCompany.getVerificationStatus());
        return updatedCompany;
    }

    @Override
    @Transactional
    public CompanyEntity updateLegalProfile(Long id, UpdateCompanyLegalProfileDto request) {
        log.info("Updating company legal profile id={}", id);
        CompanyEntity company = findById(id);

        String name = normalizeRequired(request.getName(), "Tên pháp lý doanh nghiệp là bắt buộc.");
        String province = normalizeRequired(request.getProvince(), "Tỉnh/Thành là bắt buộc.");
        String address = normalizeRequired(request.getAddress(), "Địa chỉ là bắt buộc.");
        String taxCode = normalizeOptional(request.getTaxCode());

        if (taxCode != null && companyRepository.existsByTaxCodeAndIdNot(taxCode, id)) {
            throw new IllegalArgumentException("Mã số thuế đã tồn tại trong hệ thống.");
        }

        company.setName(name);
        company.setTaxCode(taxCode);
        company.setRegistrationNumber(normalizeOptional(request.getRegistrationNumber()));
        company.setEstablishedYear(request.getEstablishedYear());
        company.setWebsite(normalizeOptional(request.getWebsite()));
        company.setProvince(province);
        company.setDistrict(normalizeOptional(request.getDistrict()));
        company.setAddress(address);
        company.setDescription(normalizeOptional(request.getDescription()));

        CompanyEntity updated = Objects.requireNonNull(companyRepository.save(company));
        log.info("Updated company legal profile id={}", updated.getId());
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public CompanyProfileAssetsResponseDto getProfileAssets(Long companyId) {
        findById(companyId);
        List<CompanyImageEntity> images = companyImageRepository
                .findByCompanyIdAndImageTypeInOrderByUploadedAtDesc(
                        companyId,
                        EnumSet.of(ImageTypeEnum.LOGO, ImageTypeEnum.FARM, ImageTypeEnum.GATE, ImageTypeEnum.WAREHOUSE,
                                ImageTypeEnum.DOCUMENT));

        String logoUrl = images.stream()
                .filter(image -> image.getImageType() == ImageTypeEnum.LOGO)
                .map(CompanyImageEntity::getImageUrl)
                .findFirst()
                .orElse(null);

        List<CompanyProfileAssetsResponseDto.MediaItemDto> farmImages = images.stream()
                .filter(image -> image.getImageType() == ImageTypeEnum.FARM
                        || image.getImageType() == ImageTypeEnum.GATE
                        || image.getImageType() == ImageTypeEnum.WAREHOUSE)
                .map(this::mapToMediaItem)
                .toList();

        List<CompanyProfileAssetsResponseDto.MediaItemDto> certificates = images.stream()
                .filter(image -> image.getImageType() == ImageTypeEnum.DOCUMENT)
                .map(this::mapToMediaItem)
                .toList();

        return CompanyProfileAssetsResponseDto.builder()
                .logoUrl(logoUrl)
                .farmImages(farmImages)
                .certificates(certificates)
                .build();
    }

    @Override
    @Transactional
    public CompanyProfileAssetsResponseDto uploadLogo(Long companyId, UpsertCompanyImageDto request) {
        findById(companyId);
        String url = normalizeRequired(request.getUrl(), "URL logo là bắt buộc.");
        companyImageRepository.deleteByCompanyIdAndImageType(companyId, ImageTypeEnum.LOGO);
        companyImageRepository.save(CompanyImageEntity.builder()
                .companyId(companyId)
                .imageUrl(url)
                .label(normalizeOptional(request.getLabel()))
                .imageType(ImageTypeEnum.LOGO)
                .uploadedAt(LocalDateTime.now())
                .build());
        return getProfileAssets(companyId);
    }

    @Override
    @Transactional
    public CompanyProfileAssetsResponseDto removeLogo(Long companyId) {
        findById(companyId);
        companyImageRepository.deleteByCompanyIdAndImageType(companyId, ImageTypeEnum.LOGO);
        return getProfileAssets(companyId);
    }

    @Override
    @Transactional
    public CompanyProfileAssetsResponseDto addFarmImage(Long companyId, UpsertCompanyImageDto request) {
        findById(companyId);
        String url = normalizeRequired(request.getUrl(), "URL ảnh trang trại là bắt buộc.");
        companyImageRepository.save(CompanyImageEntity.builder()
                .companyId(companyId)
                .imageUrl(url)
                .label(normalizeOptional(request.getLabel()))
                .imageType(ImageTypeEnum.FARM)
                .uploadedAt(LocalDateTime.now())
                .build());
        return getProfileAssets(companyId);
    }

    @Override
    @Transactional
    public CompanyProfileAssetsResponseDto addCertificate(Long companyId, UpsertCompanyImageDto request) {
        findById(companyId);
        String url = normalizeRequired(request.getUrl(), "URL chứng chỉ là bắt buộc.");
        companyImageRepository.save(CompanyImageEntity.builder()
                .companyId(companyId)
                .imageUrl(url)
                .label(normalizeOptional(request.getLabel()))
                .imageType(ImageTypeEnum.DOCUMENT)
                .uploadedAt(LocalDateTime.now())
                .build());
        return getProfileAssets(companyId);
    }

    @Override
    @Transactional
    public CompanyProfileAssetsResponseDto deleteMedia(Long companyId, Long mediaId) {
        findById(companyId);
        CompanyImageEntity media = companyImageRepository.findByIdAndCompanyId(mediaId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy ảnh/chứng chỉ."));
        companyImageRepository.delete(media);
        return getProfileAssets(companyId);
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

    private CompanyProfileAssetsResponseDto.MediaItemDto mapToMediaItem(CompanyImageEntity image) {
        return CompanyProfileAssetsResponseDto.MediaItemDto.builder()
                .id(image.getId())
                .label(firstNonBlank(image.getLabel(), extractFileName(image.getImageUrl())))
                .imageType(image.getImageType() == null ? null : image.getImageType().name())
                .url(image.getImageUrl())
                .uploadedAt(image.getUploadedAt() == null ? null : image.getUploadedAt().toString())
                .build();
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String extractFileName(String url) {
        String normalized = normalizeOptional(url);
        if (normalized == null) {
            return "Tệp";
        }
        int queryIndex = normalized.indexOf('?');
        String withoutQuery = queryIndex >= 0 ? normalized.substring(0, queryIndex) : normalized;
        int slashIndex = withoutQuery.lastIndexOf('/');
        return slashIndex >= 0 ? withoutQuery.substring(slashIndex + 1) : withoutQuery;
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }
}
