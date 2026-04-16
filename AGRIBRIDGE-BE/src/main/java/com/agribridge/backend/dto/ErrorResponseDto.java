package com.agribridge.backend.dto;

import java.util.Collections;
import java.util.Map;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ErrorResponseDto {

    private String message;
    private Map<String, String> errors;

    public static ErrorResponseDto of(String message) {
        return ErrorResponseDto.builder()
                .message(message)
                .errors(Collections.emptyMap())
                .build();
    }
}
