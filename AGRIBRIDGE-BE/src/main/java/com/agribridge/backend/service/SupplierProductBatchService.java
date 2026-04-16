package com.agribridge.backend.service;

import com.agribridge.backend.dto.CreateBatchForProductDto;
import com.agribridge.backend.dto.CreateProductOnlyDto;
import com.agribridge.backend.dto.CreateProductWithFirstBatchDto;
import com.agribridge.backend.dto.SupplierBatchCardDto;
import com.agribridge.backend.dto.SupplierBatchDetailDto;
import com.agribridge.backend.dto.SupplierCreateFlowResponseDto;
import com.agribridge.backend.dto.SupplierProductDetailDto;
import com.agribridge.backend.dto.SupplierProductOptionDto;
import com.agribridge.backend.dto.UpdateBatchDto;
import com.agribridge.backend.dto.UpdateProductDto;
import java.util.List;

public interface SupplierProductBatchService {

    SupplierCreateFlowResponseDto createProductOnly(CreateProductOnlyDto request);

    SupplierCreateFlowResponseDto createProductWithFirstBatch(CreateProductWithFirstBatchDto request);

    SupplierCreateFlowResponseDto createBatchForExistingProduct(CreateBatchForProductDto request);

    SupplierCreateFlowResponseDto updateProduct(Long productId, UpdateProductDto request);

    SupplierCreateFlowResponseDto updateBatch(Long batchId, UpdateBatchDto request);

    SupplierProductDetailDto getSupplierProductDetail(Long productId);

    SupplierBatchDetailDto getSupplierBatchDetail(Long batchId);

    List<SupplierBatchCardDto> getBatchesByProduct(Long productId);

    List<SupplierProductOptionDto> getSupplierProducts(Long supplierCompanyId);

    void deleteProduct(Long productId);

    void deleteBatch(Long batchId);
}
