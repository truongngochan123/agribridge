package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerSourcingProductDto;
import com.agribridge.backend.service.BuyerSourcingService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/products")
@RequiredArgsConstructor
public class PublicProductController {

    private final BuyerSourcingService buyerSourcingService;

    @GetMapping
    public List<BuyerSourcingProductDto> getProducts() {
        return buyerSourcingService.getProducts();
    }
}
