package com.agribridge.backend.service;

import java.time.Instant;
import java.util.Optional;

public interface AuthTokenService {

    TokenIssue issueToken(Long userId);

    Optional<Long> resolveUserId(String authorizationHeader);

    record TokenIssue(String accessToken, Instant expiresAt) {
    }
}
