package com.agribridge.backend.service;

import com.agribridge.backend.dto.AdminUserAccountDto;
import com.agribridge.backend.dto.ChangePasswordDto;
import com.agribridge.backend.dto.UpdateUserPersonalProfileDto;
import com.agribridge.backend.entity.UserEntity;
import java.util.List;

public interface UserService {
    List<UserEntity> findAll();

    UserEntity findById(Long id);

    UserEntity create(UserEntity user);

    UserEntity update(Long id, UserEntity user);

    UserEntity updatePersonalProfile(Long id, UpdateUserPersonalProfileDto request);

    void changePassword(Long id, ChangePasswordDto request);

    void delete(Long id);

    List<AdminUserAccountDto> getApprovedUsers(String search);

    AdminUserAccountDto lockUser(Long userId);

    AdminUserAccountDto unlockUser(Long userId);
}
