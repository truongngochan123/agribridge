package com.agribridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateProductDto(
                @NotBlank(message = "Product name is required") String name,
                @NotNull(message = "Category is required") Long categoryId,
                @NotBlank(message = "Unit is required") String unit,
                @NotBlank(message = "Origin province is required") String originProvince,
                String description,
                String imageUrl,
                List<String> imageUrls,
                @Valid List<CreateProductCertificationDto> certifications) {
}
