package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerBranchDtos;
import java.util.List;

public interface BuyerBranchService {

    List<BuyerBranchDtos.Summary> getBranches();

    BuyerBranchDtos.Detail getBranch(Long id);

    BuyerBranchDtos.Summary createBranch(BuyerBranchDtos.UpsertRequest request);

    BuyerBranchDtos.Summary updateBranch(Long id, BuyerBranchDtos.UpsertRequest request);

    BuyerBranchDtos.Summary updateStatus(Long id, BuyerBranchDtos.StatusRequest request);

    void deleteBranch(Long id);
}
