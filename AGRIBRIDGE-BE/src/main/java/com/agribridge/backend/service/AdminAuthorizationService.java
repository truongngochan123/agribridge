package com.agribridge.backend.service;

import com.agribridge.backend.entity.enums.UserRoleEnum;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdminAuthorizationService {

    private final CurrentUserService currentUserService;

    public void requireAdmin() {
        if (!UserRoleEnum.ADMIN.equals(currentUserService.requireCurrentUser().getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED");
        }
    }
}
