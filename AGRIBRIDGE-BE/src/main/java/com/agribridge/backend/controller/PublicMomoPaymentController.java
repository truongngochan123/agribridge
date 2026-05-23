package com.agribridge.backend.controller;

import com.agribridge.backend.service.MomoPaymentService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments/momo")
@RequiredArgsConstructor
public class PublicMomoPaymentController {
    private final MomoPaymentService momoPaymentService;

    @PostMapping("/ipn")
    public Map<String, Object> handleIpn(@RequestBody Map<String, Object> payload) {
        return momoPaymentService.handleIpn(payload);
    }
}
