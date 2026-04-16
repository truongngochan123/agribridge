package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CategoryOptionDto;
import com.agribridge.backend.dto.MetadataListResponseDto;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.service.SupplierMetadataService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/metadata")
@RequiredArgsConstructor
public class PublicMetadataController {

    private final SupplierMetadataService supplierMetadataService;
    private final CategoryRepository categoryRepository;

    @GetMapping("/units")
    public MetadataListResponseDto getUnits() {
        return new MetadataListResponseDto(supplierMetadataService.getAllowedUnits());
    }

    @GetMapping("/provinces")
    public MetadataListResponseDto getProvinces() {
        return new MetadataListResponseDto(supplierMetadataService.getVietnamProvinces());
    }

    @GetMapping("/certification-names")
    public MetadataListResponseDto getCertificationNames() {
        return new MetadataListResponseDto(supplierMetadataService.getDefaultCertificationNames());
    }

    @GetMapping("/categories")
    public List<CategoryOptionDto> getCategories() {
        return categoryRepository.findAll().stream()
                .map(category -> new CategoryOptionDto(category.getId(), category.getName()))
                .toList();
    }
}
