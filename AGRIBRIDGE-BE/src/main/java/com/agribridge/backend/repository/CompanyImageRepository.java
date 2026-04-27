package com.agribridge.backend.repository;

import com.agribridge.backend.entity.CompanyImageEntity;
import com.agribridge.backend.entity.enums.ImageTypeEnum;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyImageRepository extends JpaRepository<CompanyImageEntity, Long> {

    List<CompanyImageEntity> findByCompanyIdIn(Collection<Long> companyIds);

    List<CompanyImageEntity> findByCompanyIdOrderByUploadedAtDesc(Long companyId);

    List<CompanyImageEntity> findByCompanyIdAndImageTypeInOrderByUploadedAtDesc(Long companyId,
            Collection<ImageTypeEnum> imageTypes);

    Optional<CompanyImageEntity> findByIdAndCompanyId(Long id, Long companyId);

    void deleteByCompanyIdAndImageType(Long companyId, ImageTypeEnum imageType);
}
