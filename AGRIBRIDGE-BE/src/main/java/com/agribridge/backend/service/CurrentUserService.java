package com.agribridge.backend.service;

import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.UserEntity;

public interface CurrentUserService {

    UserEntity requireCurrentUser();

    CompanyEntity requireCurrentBuyerCompany();

    Long requireCurrentBuyerCompanyId();
}
