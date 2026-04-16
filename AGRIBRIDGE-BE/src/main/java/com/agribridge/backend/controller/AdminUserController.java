package com.agribridge.backend.controller;

import com.agribridge.backend.dto.AdminUserAccountDto;
import com.agribridge.backend.service.impl.AdminUserQueryService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserQueryService adminUserQueryService;

    public AdminUserController(AdminUserQueryService adminUserQueryService) {
        this.adminUserQueryService = adminUserQueryService;
    }

    @GetMapping
    public List<AdminUserAccountDto> getApprovedUsers(@RequestParam(name = "search", required = false) String search) {
        return adminUserQueryService.getApprovedUsers(search);
    }

    @PatchMapping("/{userId}/lock")
    public AdminUserAccountDto lockUser(@PathVariable("userId") Long userId) {
        return adminUserQueryService.lockUser(userId);
    }

    @PatchMapping("/{userId}/unlock")
    public AdminUserAccountDto unlockUser(@PathVariable("userId") Long userId) {
        return adminUserQueryService.unlockUser(userId);
    }
}
