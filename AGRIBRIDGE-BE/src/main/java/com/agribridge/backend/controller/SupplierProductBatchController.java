package com.agribridge.backend.controller;

import com.agribridge.backend.dto.CategoryOptionDto;
import com.agribridge.backend.dto.CreateBatchForProductDto;
import com.agribridge.backend.dto.CreateSupplierCategoryDto;
import com.agribridge.backend.dto.CreateProductOnlyDto;
import com.agribridge.backend.dto.CreateProductWithFirstBatchDto;
import com.agribridge.backend.dto.SupplierBatchCardDto;
import com.agribridge.backend.dto.SupplierBatchDetailDto;
import com.agribridge.backend.dto.SupplierCreateFlowResponseDto;
import com.agribridge.backend.dto.SupplierProductDetailDto;
import com.agribridge.backend.dto.SupplierProductOptionDto;
import com.agribridge.backend.dto.UpdateBatchDto;
import com.agribridge.backend.dto.UpdateProductDto;
import com.agribridge.backend.entity.CategoryEntity;
import com.agribridge.backend.repository.CategoryRepository;
import com.agribridge.backend.service.SupplierProductBatchService;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/supplier")
@RequiredArgsConstructor
public class SupplierProductBatchController {

    private final SupplierProductBatchService supplierProductBatchService;
    private final CategoryRepository categoryRepository;

    @PostMapping("/categories")
    public CategoryOptionDto createCategory(@Valid @RequestBody CreateSupplierCategoryDto request) {
        String name = request.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCase(request.userId(), name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category name already exists");
        }

        CategoryEntity common = categoryRepository.findFirstByNameIgnoreCaseAndUserIdIsNull(name).orElse(null);
        if (common != null) {
            return new CategoryOptionDto(common.getId(), common.getName());
        }

        if (categoryRepository.existsByNameIgnoreCaseAndUserIdNot(name, request.userId())) {
            CategoryEntity shared = CategoryEntity.builder()
                    .name(name)
                    .userId(null)
                    .createdAt(LocalDateTime.now())
                    .build();
            CategoryEntity saved = categoryRepository.save(shared);
            return new CategoryOptionDto(saved.getId(), saved.getName());
        }

        CategoryEntity category = CategoryEntity.builder()
                .name(name)
                .userId(request.userId())
                .createdAt(LocalDateTime.now())
                .build();
        CategoryEntity saved = categoryRepository.save(category);
        return new CategoryOptionDto(saved.getId(), saved.getName());
    }

    @PostMapping("/products")
    public SupplierCreateFlowResponseDto createProductOnly(@Valid @RequestBody CreateProductOnlyDto request) {
        return supplierProductBatchService.createProductOnly(request);
    }

    @PostMapping("/products/with-first-batch")
    public SupplierCreateFlowResponseDto createProductWithFirstBatch(
            @Valid @RequestBody CreateProductWithFirstBatchDto request) {
        return supplierProductBatchService.createProductWithFirstBatch(request);
    }

    @GetMapping("/products")
    public List<SupplierProductOptionDto> getSupplierProducts(@RequestParam(required = false) Long companyId) {
        return supplierProductBatchService.getSupplierProducts(companyId);
    }

    @GetMapping("/products/{id}")
    public SupplierProductDetailDto getSupplierProductDetail(@PathVariable("id") Long productId) {
        return supplierProductBatchService.getSupplierProductDetail(productId);
    }

    @PutMapping("/products/{id}")
    public SupplierCreateFlowResponseDto updateProduct(
            @PathVariable("id") Long productId,
            @Valid @RequestBody UpdateProductDto request) {
        return supplierProductBatchService.updateProduct(productId, request);
    }

    @DeleteMapping("/products/{id}")
    public void deleteProduct(@PathVariable("id") Long productId) {
        supplierProductBatchService.deleteProduct(productId);
    }

    @PostMapping("/batches")
    public SupplierCreateFlowResponseDto createBatchForExistingProduct(
            @Valid @RequestBody CreateBatchForProductDto request) {
        return supplierProductBatchService.createBatchForExistingProduct(request);
    }

    @GetMapping("/products/{id}/batches")
    public List<SupplierBatchCardDto> getProductBatches(@PathVariable("id") Long productId) {
        return supplierProductBatchService.getBatchesByProduct(productId);
    }

    @GetMapping("/batches/{id}")
    public SupplierBatchDetailDto getBatchDetail(@PathVariable("id") Long batchId) {
        return supplierProductBatchService.getSupplierBatchDetail(batchId);
    }

    @PutMapping("/batches/{id}")
    public SupplierCreateFlowResponseDto updateBatch(
            @PathVariable("id") Long batchId,
            @Valid @RequestBody UpdateBatchDto request) {
        return supplierProductBatchService.updateBatch(batchId, request);
    }

    @DeleteMapping("/batches/{id}")
    public void deleteBatch(@PathVariable("id") Long batchId) {
        supplierProductBatchService.deleteBatch(batchId);
    }
}
