package com.agribridge.backend.service.impl;

import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.exception.ApiException;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.AuthTokenService;
import com.agribridge.backend.service.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CurrentUserServiceImpl implements CurrentUserService {

    private static final String AUTHORIZATION_HEADER = "Authorization";

    private final HttpServletRequest request;
    private final AuthTokenService authTokenService;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;

    @Override
    public UserEntity requireCurrentUser() {
        Long userId = authTokenService.resolveUserId(request.getHeader(AUTHORIZATION_HEADER))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"));
    }

    @Override
    public CompanyEntity requireCurrentBuyerCompany() {
        UserEntity user = requireCurrentUser();
        if (user.getCompanyId() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_HAS_NO_COMPANY");
        }
        CompanyEntity company = companyRepository.findById(user.getCompanyId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "COMPANY_NOT_FOUND"));
        if (!CompanyTypeEnum.BUYER.equals(company.getCompanyType())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "COMPANY_IS_NOT_BUYER");
        }
        return company;
    }

    @Override
    public Long requireCurrentBuyerCompanyId() {
        return requireCurrentBuyerCompany().getId();
    }

    @Override
    public CompanyEntity requireCurrentSupplierCompany() {
        UserEntity user = requireCurrentUser();
        if (user.getCompanyId() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_HAS_NO_COMPANY");
        }
        CompanyEntity company = companyRepository.findById(user.getCompanyId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "COMPANY_NOT_FOUND"));
        if (!CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "COMPANY_IS_NOT_SUPPLIER");
        }
        return company;
    }

    @Override
    public Long requireCurrentSupplierCompanyId() {
        return requireCurrentSupplierCompany().getId();
    }
}
