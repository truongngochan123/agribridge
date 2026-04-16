package com.agribridge.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CreateProductCertificationDto(
        @NotBlank(message = "Certification name is required") String name,
        String documentUrl,
        String issuedBy,
        LocalDate issuedDate,
        LocalDate expiryDate) {
}
