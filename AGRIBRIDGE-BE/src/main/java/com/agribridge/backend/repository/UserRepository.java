package com.agribridge.backend.repository;

import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    boolean existsByPhone(String phone);

    boolean existsByEmailIgnoreCase(String email);

    Optional<UserEntity> findByPhone(String phone);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    Optional<UserEntity> findFirstByCompanyIdAndRole(Long companyId, UserRoleEnum role);

    List<UserEntity> findByCompanyIdInAndRole(Collection<Long> companyIds, UserRoleEnum role);
}
