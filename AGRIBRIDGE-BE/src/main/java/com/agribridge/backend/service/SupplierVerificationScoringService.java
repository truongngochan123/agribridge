package com.agribridge.backend.service;

/**
 * Calculates a verification score for a supplier registration.
 * Score >= 80 → AUTO_APPROVED; score < 80 → PENDING_REVIEW.
 */
public interface SupplierVerificationScoringService {

    /**
     * Score a supplier registration attempt.
     *
     * @param taxCode           normalized tax code (10 digits), nullable
     * @param companyName       company name as entered by the user
     * @param province          province as entered by the user
     * @param loginEmail        verified login email (already OTP-verified by this point)
     * @param loginPhone        login phone (validated and unique)
     * @param identityDocUrl    URL of uploaded CCCD/Passport document, nullable
     * @return ScoringResult containing score, reason breakdown, and tax lookup metadata
     */
    ScoringResult score(
            String taxCode,
            String companyName,
            String province,
            String loginEmail,
            String loginPhone,
            String identityDocUrl);

    record ScoringResult(
            int score,
            String reason,
            String taxLookupStatus,
            String taxLookupProvider) {
    }
}
