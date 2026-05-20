package com.agribridge.backend.entity.converter;

import com.agribridge.backend.entity.enums.UserStatusEnum;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Locale;

@Converter
public class UserStatusEnumConverter implements AttributeConverter<UserStatusEnum, String> {

    @Override
    public String convertToDatabaseColumn(UserStatusEnum attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public UserStatusEnum convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        return UserStatusEnum.valueOf(dbData.trim().toUpperCase(Locale.ROOT));
    }
}
