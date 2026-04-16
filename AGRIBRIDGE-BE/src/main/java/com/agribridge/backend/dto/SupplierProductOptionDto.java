package com.agribridge.backend.dto;

public record SupplierProductOptionDto(
        Long id,
        String name,
        Long categoryId,
        String categoryName,
        String unit,
        String originProvince,
        String imageUrl) {
}
