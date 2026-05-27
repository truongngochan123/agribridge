package com.agribridge.backend.controller;

import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.service.CompanyService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/public/suppliers")
@RequiredArgsConstructor
public class PublicSupplierController {

    private final CompanyService companyService;

    @GetMapping
    public List<CompanyEntity> getSuppliers() {
        return companyService.findAll().stream()
                .filter(company -> CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType()))
                .toList();
    }

    @GetMapping("/{id}")
    public CompanyEntity getSupplier(@PathVariable Long id) {
        CompanyEntity company = companyService.findById(id);
        if (!CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Supplier not found");
        }
        return company;
    }
}
