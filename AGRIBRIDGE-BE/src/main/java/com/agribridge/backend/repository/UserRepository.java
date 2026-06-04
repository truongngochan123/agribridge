package com.agribridge.backend.repository;

import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    boolean existsByPhone(String phone);

    boolean existsByPhoneAndIdNot(String phone, Long id);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    Optional<UserEntity> findByPhone(String phone);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    Optional<UserEntity> findFirstByCompanyIdAndRole(Long companyId, UserRoleEnum role);

    Optional<UserEntity> findFirstByCompanyIdOrderByCreatedAtAsc(Long companyId);

    List<UserEntity> findByCompanyIdInAndRole(Collection<Long> companyIds, UserRoleEnum role);

    @Query(value = """
            SELECT u.id AS id, u.company_id AS companyId
            FROM users u
            WHERE u.company_id IN (:companyIds)
              AND UPPER(u.role) = 'OWNER'
            """, nativeQuery = true)
    List<SupplierOwnerRef> findSupplierOwnerRefsByCompanyIds(@Param("companyIds") Collection<Long> companyIds);

    List<UserEntity> findByCompanyIdAndBranchIdOrderByCreatedAtDesc(Long companyId, Long branchId);

    List<UserEntity> findByCompanyIdAndBranchIdIsNullOrderByCreatedAtDesc(Long companyId);

    boolean existsByBranchId(Long branchId);

    long countByCompanyIdAndBranchId(Long companyId, Long branchId);

    @Query(value = """
            SELECT u.*
            FROM users u
            INNER JOIN companies c ON c.id = u.company_id
            WHERE UPPER(CAST(c.company_type AS NVARCHAR(50))) = 'ADMIN'
              AND UPPER(CAST(u.status AS NVARCHAR(50))) = 'ACTIVE'
            """, nativeQuery = true)
    List<UserEntity> findActiveAdminUsers();

    interface SupplierOwnerRef {
        Long getId();

        Long getCompanyId();
    }
}
