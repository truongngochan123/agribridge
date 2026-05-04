package com.agribridge.backend.controller;

import com.agribridge.backend.dto.ApproveCompanyVerificationDto;
import com.agribridge.backend.dto.CompanyProfileAssetsResponseDto;
import com.agribridge.backend.dto.UpdateCompanyLegalProfileDto;
import com.agribridge.backend.dto.UpsertCompanyImageDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.service.CompanyService;
import com.agribridge.backend.service.CurrentUserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public List<CompanyEntity> getAll() {
        return companyService.findAll();
    }

    @GetMapping("/{id}")
    public CompanyEntity getById(@PathVariable Long id) {
        return companyService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyEntity create(@RequestBody CompanyEntity company) {
        return companyService.create(company);
    }

    @PutMapping("/{id}")
    public CompanyEntity update(@PathVariable Long id, @RequestBody CompanyEntity company) {
        return companyService.update(id, company);
    }

    @PutMapping("/{id}/legal-profile")
    public CompanyEntity updateLegalProfile(@PathVariable Long id,
            @Valid @RequestBody UpdateCompanyLegalProfileDto request) {
        requireOwnCompany(id);
        return companyService.updateLegalProfile(id, request);
    }

    @GetMapping("/{id}/profile-assets")
    public CompanyProfileAssetsResponseDto getProfileAssets(@PathVariable Long id) {
        requireOwnCompany(id);
        return companyService.getProfileAssets(id);
    }

    @PostMapping("/{id}/logo")
    public CompanyProfileAssetsResponseDto uploadLogo(
            @PathVariable Long id,
            @Valid @RequestBody UpsertCompanyImageDto request) {
        requireOwnCompany(id);
        return companyService.uploadLogo(id, request);
    }

    @DeleteMapping("/{id}/logo")
    public CompanyProfileAssetsResponseDto removeLogo(@PathVariable Long id) {
        requireOwnCompany(id);
        return companyService.removeLogo(id);
    }

    @PostMapping("/{id}/farm-images")
    public CompanyProfileAssetsResponseDto addFarmImage(
            @PathVariable Long id,
            @Valid @RequestBody UpsertCompanyImageDto request) {
        requireOwnCompany(id);
        return companyService.addFarmImage(id, request);
    }

    @PostMapping("/{id}/certificates")
    public CompanyProfileAssetsResponseDto addCertificate(
            @PathVariable Long id,
            @Valid @RequestBody UpsertCompanyImageDto request) {
        requireOwnCompany(id);
        return companyService.addCertificate(id, request);
    }

    @DeleteMapping("/{id}/media/{mediaId}")
    public CompanyProfileAssetsResponseDto deleteMedia(@PathVariable Long id, @PathVariable Long mediaId) {
        requireOwnCompany(id);
        return companyService.deleteMedia(id, mediaId);
    }

    private void requireOwnCompany(Long companyId) {
        Long currentCompanyId = currentUserService.requireCurrentUser().getCompanyId();
        if (!currentCompanyId.equals(companyId)) {
            throw new IllegalArgumentException("COMPANY_PROFILE_ACCESS_DENIED");
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        companyService.delete(id);
    }

    @PostMapping("/{id}/approve-verification")
    public CompanyEntity approveVerification(@PathVariable Long id,
            @Valid @RequestBody ApproveCompanyVerificationDto request) {
        return companyService.approveVerification(id, request.getVerifiedByUserId());
    }
}
