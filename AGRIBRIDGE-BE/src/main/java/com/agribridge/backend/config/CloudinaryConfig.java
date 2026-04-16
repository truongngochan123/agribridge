package com.agribridge.backend.config;

import com.cloudinary.Cloudinary;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    @Bean
    public Cloudinary cloudinary() {
        Map<String, String> config = new HashMap<>();
        config.put("cloud_name", cloudName == null ? "" : cloudName.trim());
        config.put("api_key", apiKey == null ? "" : apiKey.trim());
        config.put("api_secret", apiSecret == null ? "" : apiSecret.trim());
        config.put("secure", "true");

        if (config.get("cloud_name").isBlank() || config.get("api_key").isBlank() || config.get("api_secret").isBlank()) {
            log.warn("Cloudinary is not configured. Upload endpoints will be unavailable until CLOUDINARY_* is set.");
        }

        return new Cloudinary(config);
    }
}
