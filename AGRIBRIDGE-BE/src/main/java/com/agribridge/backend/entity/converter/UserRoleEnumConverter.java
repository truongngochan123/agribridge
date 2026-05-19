package com.agribridge.backend.entity.converter;

import com.agribridge.backend.entity.enums.UserRoleEnum;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Locale;

@Converter
public class UserRoleEnumConverter implements AttributeConverter<UserRoleEnum, String> {

    @Override
    public String convertToDatabaseColumn(UserRoleEnum attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public UserRoleEnum convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        return UserRoleEnum.valueOf(dbData.trim().toUpperCase(Locale.ROOT));
    }
}
