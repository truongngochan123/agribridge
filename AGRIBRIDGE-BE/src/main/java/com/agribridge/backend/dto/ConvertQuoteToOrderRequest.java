package com.agribridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record ConvertQuoteToOrderRequest(
        String deliveryAddress,
        String deliveryProvince,
        String note,
        @JsonAlias("create_invoice") Boolean createInvoice) {
}
