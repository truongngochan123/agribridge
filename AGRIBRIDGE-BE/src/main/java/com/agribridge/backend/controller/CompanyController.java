package com.agribridge.backend.controller;

import com.agribridge.backend.dto.ApproveCompanyVerificationDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.service.CompanyService;
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
