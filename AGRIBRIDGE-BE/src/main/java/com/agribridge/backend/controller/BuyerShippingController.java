package com.agribridge.backend.controller;

import com.agribridge.backend.dto.shipping.ShippingQuoteRequest;
import com.agribridge.backend.dto.shipping.ShippingQuoteResponse;
import com.agribridge.backend.service.GhnAddressMappingService;
import com.agribridge.backend.service.GhnShippingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/shipping")
@RequiredArgsConstructor
@Slf4j
public class BuyerShippingController {

    private final GhnShippingService ghnShippingService;
    private final GhnAddressMappingService ghnAddressMappingService;

    @PostMapping("/quote")
    public ShippingQuoteResponse quote(@Valid @RequestBody ShippingQuoteRequest request) {
        log.info(
                "POST /api/buyer/shipping/quote: toProvince={}, toWard={}, toAddress={}",
                request.toProvince(),
                request.toWard(),
                request.toAddress());
        return ghnShippingService.quote(request);
    }

    @GetMapping("/debug-location")
    public GhnAddressMappingService.DebugLocationResponse debugLocation(
            @RequestParam String province,
            @RequestParam(required = false, defaultValue = "") String district,
            @RequestParam String ward) {
        return ghnAddressMappingService.debugLocation(province, district, ward);
    }
}
