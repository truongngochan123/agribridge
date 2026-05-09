package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CategoryOptionDto;
import com.agribridge.backend.dto.MetadataListResponseDto;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.service.SupplierMetadataService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public List<CategoryOptionDto> getCategories(@RequestParam(required = false) Long userId) {
        if (userId == null) {
            return categoryRepository.findByUserIdIsNullOrderByNameAsc().stream()
                    .map(category -> new CategoryOptionDto(category.getId(), category.getName()))
                    .toList();
        }

        List<CategoryOptionDto> merged = new ArrayList<>();
        Map<String, CategoryOptionDto> byName = new LinkedHashMap<>();

        for (var category : categoryRepository.findByUserIdIsNullOrderByNameAsc()) {
            String key = normalizeCategoryName(category.getName());
            byName.putIfAbsent(key, new CategoryOptionDto(category.getId(), category.getName()));
        }

        for (var category : categoryRepository.findByUserIdOrderByNameAsc(userId)) {
            String key = normalizeCategoryName(category.getName());
            byName.putIfAbsent(key, new CategoryOptionDto(category.getId(), category.getName()));
        }

        merged.addAll(byName.values());
        return merged;
    }

    private String normalizeCategoryName(String name) {
        if (name == null) {
            return "";
        }
        return name.trim().toLowerCase(Locale.ROOT);
    }
}
