package com.agribridge.backend.util;

import java.util.ArrayList;
import java.util.List;

public final class RegistrationDescriptionUtils {

    private static final String REGISTRATION_PREFIX = "registrationNo=";
    private static final String DISTRICT_PREFIX = "district=";

    private RegistrationDescriptionUtils() {
    }

    public static String buildDescription(String description, String registrationNumber) {
        List<String> parts = new ArrayList<>();
        String safeDescription = normalize(description);
        String safeRegistrationNumber = normalize(registrationNumber);

        if (safeDescription != null) {
            parts.add(safeDescription);
        }
        if (safeRegistrationNumber != null) {
            parts.add(REGISTRATION_PREFIX + safeRegistrationNumber);
        }
        return parts.isEmpty() ? null : String.join(" | ", parts);
    }

    public static String extractRegistrationNumber(String rawDescription) {
        if (rawDescription == null || rawDescription.isBlank()) {
            return null;
        }
        for (String token : rawDescription.split("\\s*\\|\\s*")) {
            String trimmed = token.trim();
            if (trimmed.regionMatches(true, 0, REGISTRATION_PREFIX, 0, REGISTRATION_PREFIX.length())) {
                String value = trimmed.substring(REGISTRATION_PREFIX.length()).trim();
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }

    public static String extractDisplayDescription(String rawDescription) {
        if (rawDescription == null || rawDescription.isBlank()) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (String token : rawDescription.split("\\s*\\|\\s*")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.regionMatches(true, 0, REGISTRATION_PREFIX, 0, REGISTRATION_PREFIX.length())) {
                continue;
            }
            if (trimmed.regionMatches(true, 0, DISTRICT_PREFIX, 0, DISTRICT_PREFIX.length())) {
                continue;
            }
            parts.add(trimmed);
        }
        return parts.isEmpty() ? null : String.join(" | ", parts);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
