package com.agribridge.backend.repository;

import com.agribridge.backend.entity.CategoryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<CategoryEntity, Long> {
    List<CategoryEntity> findByUserIdIsNullOrderByNameAsc();

    List<CategoryEntity> findByUserIdIsNullOrUserIdOrderByNameAsc(Long userId);

    boolean existsByUserIdAndNameIgnoreCase(Long userId, String name);

    boolean existsByUserIdIsNullAndNameIgnoreCase(String name);
}
