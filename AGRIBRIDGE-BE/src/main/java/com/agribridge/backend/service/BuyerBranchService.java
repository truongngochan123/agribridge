package com.agribridge.backend.service;

import com.agribridge.backend.dto.BuyerBranchDtos;
import java.util.List;

public interface BuyerBranchService {

    List<BuyerBranchDtos.Summary> getBranches();

    BuyerBranchDtos.Detail getBranch(Long id);

    BuyerBranchDtos.Summary createBranch(BuyerBranchDtos.UpsertRequest request);

    BuyerBranchDtos.Summary updateBranch(Long id, BuyerBranchDtos.UpsertRequest request);

    BuyerBranchDtos.Summary updateStatus(Long id, BuyerBranchDtos.StatusRequest request);

    BuyerBranchDtos.Staff createEmployee(Long branchId, BuyerBranchDtos.EmployeeCreateRequest request);

    BuyerBranchDtos.Staff assignEmployee(Long branchId, BuyerBranchDtos.EmployeeAssignRequest request);

    List<BuyerBranchDtos.Staff> getAssignableEmployees(Long branchId, String search);

    BuyerBranchDtos.EmployeeAvailability checkEmployeeAvailability(String email, String phone);

    void deleteBranch(Long id);
}
