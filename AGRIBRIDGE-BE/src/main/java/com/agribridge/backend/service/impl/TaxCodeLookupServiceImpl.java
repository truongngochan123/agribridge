package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.TaxCodeLookupResponseDto;
import com.agribridge.backend.service.TaxCodeLookupService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
@Slf4j
public class TaxCodeLookupServiceImpl implements TaxCodeLookupService {

    private static final String PROVIDER_VIETQR = "VIETQR";
    private static final String PROVIDER_XINVOICE = "XINVOICE";
    private static final String PROVIDER_CASSO = "CASSO";

    private final RestClient restClient;
    private final String vietQrBaseUrl;
    private final String xinvoiceLookupUrl;
    private final String xinvoiceAuthHeader;
    private final String xinvoiceToken;
    private final String cassoLookupUrl;
    private final String cassoAuthHeader;
    private final String cassoToken;

    public TaxCodeLookupServiceImpl(
            RestClient.Builder restClientBuilder,
            @Value("${taxcode.vietqr.base-url:https://api.vietqr.io}") String vietQrBaseUrl,
            @Value("${taxcode.xinvoice.lookup-url:}") String xinvoiceLookupUrl,
            @Value("${taxcode.xinvoice.auth-header:Authorization}") String xinvoiceAuthHeader,
            @Value("${taxcode.xinvoice.token:}") String xinvoiceToken,
            @Value("${taxcode.casso.lookup-url:}") String cassoLookupUrl,
            @Value("${taxcode.casso.auth-header:Authorization}") String cassoAuthHeader,
            @Value("${taxcode.casso.token:}") String cassoToken) {
        this.restClient = restClientBuilder.build();
        this.vietQrBaseUrl = stripTrailingSlash(vietQrBaseUrl);
        this.xinvoiceLookupUrl = xinvoiceLookupUrl;
        this.xinvoiceAuthHeader = xinvoiceAuthHeader;
        this.xinvoiceToken = xinvoiceToken;
        this.cassoLookupUrl = cassoLookupUrl;
        this.cassoAuthHeader = cassoAuthHeader;
        this.cassoToken = cassoToken;
    }

    @Override
    public TaxCodeLookupResponseDto lookupTaxCode(String taxCode) {
        String normalizedTaxCode = normalizeDigitsOnly(taxCode);
        if (!isValidTaxCode(normalizedTaxCode)) {
            return TaxCodeLookupResponseDto.builder()
                    .found(false)
                    .taxCode(normalizedTaxCode)
                    .message("Tax code must be exactly 10 digits")
                    .build();
        }

        TaxCodeLookupResponseDto vietQr = lookupVietQr(normalizedTaxCode);
        if (vietQr != null && vietQr.isFound()) {
            return vietQr;
        }

        TaxCodeLookupResponseDto xinvoice = lookupGenericProvider(
                PROVIDER_XINVOICE,
                xinvoiceLookupUrl,
                xinvoiceAuthHeader,
                xinvoiceToken,
                normalizedTaxCode);
        if (xinvoice != null && xinvoice.isFound()) {
            return xinvoice;
        }

        TaxCodeLookupResponseDto casso = lookupGenericProvider(
                PROVIDER_CASSO,
                cassoLookupUrl,
                cassoAuthHeader,
                cassoToken,
                normalizedTaxCode);
        if (casso != null && casso.isFound()) {
            return casso;
        }

        return TaxCodeLookupResponseDto.builder()
                .found(false)
                .taxCode(normalizedTaxCode)
                .message("No official profile found for this tax code")
                .build();
    }

    private TaxCodeLookupResponseDto lookupVietQr(String taxCode) {
        String url = vietQrBaseUrl + "/v2/business/" + taxCode;
        try {
            JsonNode root = restClient.get().uri(url).retrieve().body(JsonNode.class);
            if (root == null) {
                return null;
            }

            String code = readText(root, "code");
            String desc = readText(root, "desc");
            JsonNode data = resolveDataNode(root);
            if (!"00".equals(code)) {
                return TaxCodeLookupResponseDto.builder()
                        .found(false)
                        .provider(PROVIDER_VIETQR)
                        .taxCode(taxCode)
                        .status(code)
                        .message(desc)
                        .build();
            }

            return buildResponse(PROVIDER_VIETQR, taxCode, data, code, desc);
        } catch (RestClientException ex) {
            log.warn("VietQR lookup failed taxCode={} reason={}", taxCode, ex.getMessage());
            return null;
        }
    }

    private TaxCodeLookupResponseDto lookupGenericProvider(
            String provider,
            String lookupUrl,
            String authHeader,
            String token,
            String taxCode) {
        if (!StringUtils.hasText(lookupUrl)) {
            return null;
        }

        String resolvedUrl = lookupUrl.replace("{taxCode}", taxCode);
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.get().uri(resolvedUrl);
            if (StringUtils.hasText(token)) {
                request = request.header(authHeader, token);
            }

            JsonNode root = request.retrieve().body(JsonNode.class);
            if (root == null) {
                return null;
            }

            String status = readText(root, "code", "status");
            String message = readText(root, "message", "desc", "error");
            JsonNode data = resolveDataNode(root);
            TaxCodeLookupResponseDto response = buildResponse(provider, taxCode, data, status, message);
            if (response.isFound()) {
                return response;
            }

            return TaxCodeLookupResponseDto.builder()
                    .found(false)
                    .provider(provider)
                    .taxCode(taxCode)
                    .status(status)
                    .message(message)
                    .build();
        } catch (RestClientException ex) {
            log.warn("{} lookup failed taxCode={} reason={}", provider, taxCode, ex.getMessage());
            return null;
        }
    }

    private TaxCodeLookupResponseDto buildResponse(
            String provider,
            String taxCode,
            JsonNode data,
            String status,
            String message) {
        if (data == null || data.isMissingNode()) {
            return TaxCodeLookupResponseDto.builder()
                    .found(false)
                    .provider(provider)
                    .taxCode(taxCode)
                    .status(status)
                    .message(message)
                    .build();
        }

        String companyName = readText(data, "companyName", "name", "ten", "tenCongTy");
        String address = readText(data, "address", "diaChi", "companyAddress");
        String province = readText(data, "province", "tinh", "city", "thanhPho");
        String ward = readText(data, "ward", "phuong", "xa", "district");

        boolean found = StringUtils.hasText(companyName) || StringUtils.hasText(address);

        return TaxCodeLookupResponseDto.builder()
                .found(found)
                .provider(provider)
                .taxCode(taxCode)
                .companyName(companyName)
                .address(address)
                .province(province)
                .ward(ward)
                .status(status)
                .message(message)
                .build();
    }

    private JsonNode resolveDataNode(JsonNode root) {
        if (root == null) {
            return null;
        }

        List<String> candidates = List.of("data", "result", "company", "business", "payload");
        for (String key : candidates) {
            JsonNode node = root.path(key);
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                return node;
            }
        }
        return root;
    }

    private String readText(JsonNode node, String... keys) {
        if (node == null) {
            return null;
        }
        for (String key : keys) {
            JsonNode value = node.path(key);
            if (value != null && value.isValueNode()) {
                String text = value.asText();
                if (StringUtils.hasText(text)) {
                    return text.trim();
                }
            }
        }
        return null;
    }

    private String normalizeDigitsOnly(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.replaceAll("\\D", "");
    }

    private boolean isValidTaxCode(String value) {
        return value != null && value.length() == 10;
    }

    private String stripTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
