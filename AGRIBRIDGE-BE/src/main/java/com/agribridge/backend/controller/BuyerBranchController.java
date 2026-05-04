package com.agribridge.backend.controller;

import com.agribridge.backend.dto.BuyerBranchDtos;
import com.agribridge.backend.service.BuyerBranchService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buyer/branches")
@RequiredArgsConstructor
public class BuyerBranchController {

    private final BuyerBranchService buyerBranchService;

    @GetMapping
    public List<BuyerBranchDtos.Summary> getBranches() {
        return buyerBranchService.getBranches();
    }

    @GetMapping("/{id}")
    public BuyerBranchDtos.Detail getBranch(@PathVariable Long id) {
        return buyerBranchService.getBranch(id);
    }

    @PostMapping
    public BuyerBranchDtos.Summary createBranch(@RequestBody BuyerBranchDtos.UpsertRequest request) {
        return buyerBranchService.createBranch(request);
    }

    @PutMapping("/{id}")
    public BuyerBranchDtos.Summary updateBranch(@PathVariable Long id, @RequestBody BuyerBranchDtos.UpsertRequest request) {
        return buyerBranchService.updateBranch(id, request);
    }

    @PatchMapping("/{id}/status")
    public BuyerBranchDtos.Summary updateStatus(@PathVariable Long id, @RequestBody BuyerBranchDtos.StatusRequest request) {
        return buyerBranchService.updateStatus(id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteBranch(@PathVariable Long id) {
        buyerBranchService.deleteBranch(id);
    }
}
