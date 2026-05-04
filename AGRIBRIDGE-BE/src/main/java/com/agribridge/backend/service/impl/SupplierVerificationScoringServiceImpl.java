package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.TaxCodeLookupResponseDto;
import com.agribridge.backend.service.SupplierVerificationScoringService;
import com.agribridge.backend.service.TaxCodeLookupService;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Implements the supplier auto-verification scoring rules:
 * +30  MST found from VietQR / XInvoice / Casso
 * +20  Company name fuzzy-matches tax-lookup name >= 80%
 * +10  Province matches tax-lookup data
 * +15  Email verified via OTP (always true at this point – caller guarantees it)
 * +15  Phone is valid (phone OTP not implemented; awarded when phone present)
 * +10  Identity document (CCCD / Passport) uploaded
 * Total >= 80 → AUTO_APPROVED
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierVerificationScoringServiceImpl implements SupplierVerificationScoringService {

    private static final int SCORE_TAX_FOUND      = 30;
    private static final int SCORE_NAME_MATCH      = 20;
    private static final int SCORE_PROVINCE_MATCH  = 10;
    private static final int SCORE_EMAIL_VERIFIED  = 15;
    private static final int SCORE_PHONE_PRESENT   = 15;
    private static final int SCORE_IDENTITY_DOC    = 10;

    private static final double NAME_SIMILARITY_THRESHOLD = 0.80;

    private final TaxCodeLookupService taxCodeLookupService;

    @Override
    public ScoringResult score(
            String taxCode,
            String companyName,
            String province,
            String loginEmail,
            String loginPhone,
            String identityDocUrl) {

        log.info("Scoring supplier registration taxCode={} companyName={} province={}",
                taxCode, companyName, province);

        int score = 0;
        List<String> reasons = new ArrayList<>();
        String taxLookupStatus = null;
        String taxLookupProvider = null;

        // ── Rule: email OTP verified (caller guarantees this) ──────────────────────
        if (StringUtils.hasText(loginEmail)) {
            score += SCORE_EMAIL_VERIFIED;
            reasons.add("+15 email OTP đã xác minh");
        }

        // ── Rule: phone present (phone OTP not implemented yet) ────────────────────
        if (StringUtils.hasText(loginPhone)) {
            score += SCORE_PHONE_PRESENT;
            reasons.add("+15 số điện thoại hợp lệ");
        }

        // ── Rule: identity document uploaded ──────────────────────────────────────
        if (StringUtils.hasText(identityDocUrl)) {
            score += SCORE_IDENTITY_DOC;
            reasons.add("+10 giấy tờ định danh đã tải lên");
        } else {
            reasons.add("+0 chưa tải lên giấy tờ định danh");
        }

        // ── Tax code lookup ────────────────────────────────────────────────────────
        String normalizedTaxCode = normalizeDigitsOnly(taxCode);
        if (!isValidTaxCode(normalizedTaxCode)) {
            taxLookupStatus = "SKIPPED_INVALID";
            reasons.add("+0 MST không hợp lệ hoặc để trống, bỏ qua tra cứu");
            log.info("Skipping tax lookup: invalid or missing taxCode");
        } else {
            TaxCodeLookupResponseDto lookup = tryLookupTaxCode(normalizedTaxCode);
            if (lookup == null) {
                // Provider error / exception
                taxLookupStatus = "PROVIDER_ERROR";
                reasons.add("+0 tra cứu MST gặp lỗi từ provider, không cộng điểm");
                log.warn("Tax lookup threw exception for taxCode={}", normalizedTaxCode);
            } else if (!lookup.isFound()) {
                taxLookupStatus = "NOT_FOUND";
                taxLookupProvider = lookup.getProvider();
                reasons.add("+0 MST không tìm thấy trên hệ thống thuế: " + safeMsg(lookup));
                log.info("Tax lookup: not found taxCode={} msg={}", normalizedTaxCode, lookup.getMessage());
            } else {
                // Found!
                taxLookupStatus = "FOUND";
                taxLookupProvider = lookup.getProvider();
                score += SCORE_TAX_FOUND;
                reasons.add("+30 MST tìm thấy từ " + lookup.getProvider());
                log.info("Tax lookup: found taxCode={} provider={} companyName={}",
                        normalizedTaxCode, lookup.getProvider(), lookup.getCompanyName());

                // ── Rule: name fuzzy match ─────────────────────────────────────────
                String lookupName = lookup.getCompanyName();
                double nameSim = nameSimilarity(companyName, lookupName);
                if (nameSim >= NAME_SIMILARITY_THRESHOLD) {
                    score += SCORE_NAME_MATCH;
                    reasons.add(String.format("+20 tên công ty khớp %.0f%% với dữ liệu thuế", nameSim * 100));
                } else {
                    reasons.add(String.format("+0 tên công ty chỉ khớp %.0f%% (cần >= 80%%)", nameSim * 100));
                }

                // ── Rule: province match ───────────────────────────────────────────
                if (provinceMatches(province, lookup.getProvince())) {
                    score += SCORE_PROVINCE_MATCH;
                    reasons.add("+10 tỉnh/thành khớp với dữ liệu thuế");
                } else {
                    reasons.add("+0 tỉnh/thành không khớp với dữ liệu thuế");
                }
            }
        }

        String reason = String.join(" | ", reasons);
        log.info("Verification score={} taxCode={} reason={}", score, normalizedTaxCode, reason);
        return new ScoringResult(score, reason, taxLookupStatus, taxLookupProvider);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private TaxCodeLookupResponseDto tryLookupTaxCode(String taxCode) {
        try {
            return taxCodeLookupService.lookupTaxCode(taxCode);
        } catch (Exception ex) {
            log.warn("Tax lookup exception taxCode={} error={}", taxCode, ex.getMessage());
            return null;
        }
    }

    /**
     * Computes a simple similarity score between two company names.
     * Uses normalized token overlap: |intersection(tokens_a, tokens_b)| / max(|tokens_a|, |tokens_b|).
     * Falls back to character-level Levenshtein for short strings.
     */
    static double nameSimilarity(String a, String b) {
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return 0.0;
        }
        String na = normalizeName(a);
        String nb = normalizeName(b);
        if (na.equals(nb)) {
            return 1.0;
        }
        if (na.contains(nb) || nb.contains(na)) {
            int shorter = Math.min(na.length(), nb.length());
            int longer  = Math.max(na.length(), nb.length());
            return (double) shorter / longer;
        }
        // Token overlap
        String[] tokensA = na.split("\\s+");
        String[] tokensB = nb.split("\\s+");
        int matches = 0;
        for (String ta : tokensA) {
            if (ta.length() <= 1) continue;
            for (String tb : tokensB) {
                if (ta.equals(tb)) {
                    matches++;
                    break;
                }
            }
        }
        int denominator = Math.max(tokensA.length, tokensB.length);
        if (denominator == 0) return 0.0;
        double tokenSim = (double) matches / denominator;
        if (tokenSim >= NAME_SIMILARITY_THRESHOLD) {
            return tokenSim;
        }
        // Levenshtein fallback
        double levSim = levenshteinSimilarity(na, nb);
        return Math.max(tokenSim, levSim);
    }

    private static String normalizeName(String raw) {
        // Remove legal suffixes, lowercase, collapse spaces
        String n = raw.toLowerCase(Locale.ROOT)
                .replaceAll("(?i)\\b(công ty|tnhh|cổ phần|một thành viên|mtv|co\\.?\\s*ltd\\.?|joint stock|jsc|llc|inc\\.?)\\b", " ")
                .replaceAll("[^a-z0-9àáâãäåèéêëìíîïòóôõöùúûüýỳỹỷỵỡợờởởặấầẩẫậắằẳẵặđ ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return n;
    }

    private static double levenshteinSimilarity(String a, String b) {
        int la = a.length();
        int lb = b.length();
        if (la == 0 && lb == 0) return 1.0;
        if (la == 0 || lb == 0) return 0.0;
        int maxLen = Math.max(la, lb);
        int dist = levenshtein(a, b);
        return 1.0 - (double) dist / maxLen;
    }

    private static int levenshtein(String a, String b) {
        int la = a.length();
        int lb = b.length();
        int[] prev = new int[lb + 1];
        int[] curr = new int[lb + 1];
        for (int j = 0; j <= lb; j++) prev[j] = j;
        for (int i = 1; i <= la; i++) {
            curr[0] = i;
            for (int j = 1; j <= lb; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(Math.min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = curr; curr = tmp;
        }
        return prev[lb];
    }

    private boolean provinceMatches(String userProvince, String lookupProvince) {
        if (!StringUtils.hasText(userProvince) || !StringUtils.hasText(lookupProvince)) {
            return false;
        }
        String np = normalize(userProvince);
        String nl = normalize(lookupProvince);
        return np.equals(nl) || np.contains(nl) || nl.contains(np);
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT)
                .replaceAll("(?i)\\b(tỉnh|thành phố|tp\\.?|city)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeDigitsOnly(String value) {
        if (!StringUtils.hasText(value)) return null;
        String d = value.replaceAll("\\D", "");
        return d.isEmpty() ? null : d;
    }

    private boolean isValidTaxCode(String taxCode) {
        return taxCode != null && taxCode.length() == 10;
    }

    private String safeMsg(TaxCodeLookupResponseDto dto) {
        if (dto == null) return "";
        return dto.getMessage() != null ? dto.getMessage() : "không có thông tin";
    }
}
