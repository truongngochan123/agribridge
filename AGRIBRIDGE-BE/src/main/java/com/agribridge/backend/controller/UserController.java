package com.agribridge.backend.controller;

import com.agribridge.backend.dto.UpdateUserPersonalProfileDto;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public List<UserEntity> getAll() {
        return userService.findAll();
    }

    @GetMapping("/{id}")
    public UserEntity getById(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserEntity create(@RequestBody UserEntity user) {
        return userService.create(user);
    }

    @PutMapping("/{id}")
    public UserEntity update(@PathVariable Long id, @RequestBody UserEntity user) {
        return userService.update(id, user);
    }

    @PutMapping("/{id}/personal-profile")
    public UserEntity updatePersonalProfile(@PathVariable Long id,
            @Valid @RequestBody UpdateUserPersonalProfileDto request) {
        Long currentUserId = currentUserService.requireCurrentUser().getId();
        if (!currentUserId.equals(id)) {
            throw new IllegalArgumentException("USER_PROFILE_ACCESS_DENIED");
        }
        return userService.updatePersonalProfile(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
