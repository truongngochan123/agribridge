package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerSourcingProductDto;
import com.agribridge.backend.dto.CreateBuyerRfqDto;
import com.agribridge.backend.service.BuyerSourcingService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/sourcing")
@RequiredArgsConstructor
public class BuyerSourcingController {

    private final BuyerSourcingService buyerSourcingService;

    @GetMapping("/products")
    public List<BuyerSourcingProductDto> getProducts() {
        return buyerSourcingService.getProducts();
    }

    @GetMapping("/products/{productId}")
    public BuyerSourcingProductDto getProduct(@PathVariable Long productId) {
        return buyerSourcingService.getProduct(productId);
    }

    @PostMapping("/rfqs")
    public Map<String, Long> createRfq(@Valid @RequestBody CreateBuyerRfqDto request) {
        return Map.of("rfqId", buyerSourcingService.createRfq(request));
    }
}
