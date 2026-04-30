package com.agribridge.backend.service.impl;

import com.agribridge.backend.service.AuthTokenService;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class HmacAuthTokenService implements AuthTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String BEARER_PREFIX = "Bearer ";

    @Value("${app.auth.token-secret:${AUTH_TOKEN_SECRET:agribridge-local-dev-token-secret-change-me}}")
    private String tokenSecret;

    @Value("${app.auth.token-ttl-hours:${AUTH_TOKEN_TTL_HOURS:12}}")
    private long tokenTtlHours;

    @Override
    public TokenIssue issueToken(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        Instant expiresAt = Instant.now().plus(Duration.ofHours(Math.max(tokenTtlHours, 1)));
        String payload = userId + ":" + expiresAt.getEpochSecond();
        String encodedPayload = encode(payload.getBytes(StandardCharsets.UTF_8));
        String signature = sign(encodedPayload);
        return new TokenIssue(encodedPayload + "." + signature, expiresAt);
    }

    @Override
    public Optional<Long> resolveUserId(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return Optional.empty();
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
            return Optional.empty();
        }
        if (!constantTimeEquals(sign(parts[0]), parts[1])) {
            return Optional.empty();
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
        String[] payloadParts = payload.split(":", -1);
        if (payloadParts.length != 2) {
            return Optional.empty();
        }
        try {
            long userId = Long.parseLong(payloadParts[0]);
            long expiresAtEpoch = Long.parseLong(payloadParts[1]);
            if (Instant.now().getEpochSecond() >= expiresAtEpoch) {
                return Optional.empty();
            }
            return Optional.of(userId);
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    private String sign(String encodedPayload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(tokenSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return encode(mac.doFinal(encodedPayload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("AUTH_TOKEN_SIGN_FAILED", exception);
        }
    }

    private String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        byte[] leftBytes = left.getBytes(StandardCharsets.UTF_8);
        byte[] rightBytes = right.getBytes(StandardCharsets.UTF_8);
        if (leftBytes.length != rightBytes.length) {
            return false;
        }
        int result = 0;
        for (int index = 0; index < leftBytes.length; index += 1) {
            result |= leftBytes[index] ^ rightBytes[index];
        }
        return result == 0;
    }
}
