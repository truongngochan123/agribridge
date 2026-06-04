package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminCategoryDtos;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.service.AdminAuthorizationService;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
public class AdminCategoryController {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final AdminAuthorizationService adminAuthorizationService;

    @GetMapping
    public List<AdminCategoryDtos.CategoryItem> listCategories() {
        adminAuthorizationService.requireAdmin();
        return categoryRepository.findAll().stream()
                .sorted(Comparator.comparing((CategoryEntity item) -> item.getName() == null ? "" : item.getName(), String.CASE_INSENSITIVE_ORDER))
                .map(this::toItem)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminCategoryDtos.CategoryItem createCategory(@RequestBody AdminCategoryDtos.CategoryRequest request) {
        adminAuthorizationService.requireAdmin();
        String name = cleanName(request == null ? null : request.name());
        ensureUniqueName(name, null);
        CategoryEntity saved = categoryRepository.save(CategoryEntity.builder()
                .name(name)
                .description(cleanDescription(request == null ? null : request.description()))
                .userId(null)
                .createdAt(LocalDateTime.now())
                .build());
        return toItem(saved);
    }

    @PutMapping("/{id}")
    public AdminCategoryDtos.CategoryItem updateCategory(@PathVariable Long id, @RequestBody AdminCategoryDtos.CategoryRequest request) {
        adminAuthorizationService.requireAdmin();
        CategoryEntity category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND"));
        String name = cleanName(request == null ? null : request.name());
        ensureUniqueName(name, id);
        category.setName(name);
        category.setDescription(cleanDescription(request == null ? null : request.description()));
        return toItem(categoryRepository.save(category));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        adminAuthorizationService.requireAdmin();
        CategoryEntity category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND"));
        long productCount = productRepository.countByCategoryId(id);
        if (productCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CATEGORY_IN_USE");
        }
        categoryRepository.delete(category);
    }

    private String cleanName(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CATEGORY_NAME_REQUIRED");
        }
        if (name.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CATEGORY_NAME_TOO_LONG");
        }
        return name;
    }

    private String cleanDescription(String value) {
        String description = value == null ? null : value.trim();
        if (description == null || description.isBlank()) {
            return null;
        }
        if (description.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CATEGORY_DESCRIPTION_TOO_LONG");
        }
        return description;
    }

    private void ensureUniqueName(String name, Long currentId) {
        String normalized = name.toLowerCase(Locale.ROOT);
        boolean duplicated = categoryRepository.findAll().stream()
                .anyMatch(item -> !item.getId().equals(currentId)
                        && item.getName() != null
                        && item.getName().trim().toLowerCase(Locale.ROOT).equals(normalized));
        if (duplicated) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CATEGORY_NAME_EXISTS");
        }
    }

    private AdminCategoryDtos.CategoryItem toItem(CategoryEntity category) {
        long productCount = productRepository.countByCategoryId(category.getId());
        return new AdminCategoryDtos.CategoryItem(
                category.getId(),
                category.getName(),
                category.getDescription(),
                category.getUserId(),
                category.getUserId() == null ? "Mặc định" : "Nhà cung cấp",
                productCount,
                category.getCreatedAt());
    }
}
