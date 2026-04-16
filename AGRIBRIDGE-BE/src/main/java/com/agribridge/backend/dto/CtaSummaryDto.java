package com.agribridge.backend.dto;

import lombok.Builder;

@Builder
public record CtaSummaryDto(
        CtaBlockDto supplier,
        CtaBlockDto buyer
) {
}
