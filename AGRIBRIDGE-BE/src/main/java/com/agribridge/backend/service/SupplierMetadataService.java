package com.agribridge.backend.service;

import java.util.List;

public interface SupplierMetadataService {

    List<String> getAllowedUnits();

    List<String> getVietnamProvinces();

    List<String> getDefaultCertificationNames();

    boolean isAllowedUnit(String unit);

    boolean isValidProvince(String province);
}
