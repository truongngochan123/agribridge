package com.agribridge.backend.dto;

import com.agribridge.backend.entity.enums.QcResultEnum;
import jakarta.validation.constraints.NotNull;

public record CreateQcRecordDto(
        @NotNull(message = "QC result is required") QcResultEnum result,
        String documentUrl,
        String notes) {
}
