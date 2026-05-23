package com.agribridge.backend.service.impl;

import com.agribridge.backend.service.OutboundEmailService;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@Slf4j
public class ResendEmailServiceImpl implements OutboundEmailService {

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.from:}")
    private String resendFrom;

    @Value("${app.mail.from-address:}")
    private String fromAddress;

    @Value("${app.mail.from-name:AgriBridge}")
    private String fromName;

    @Override
    public void sendTextEmail(String to, String subject, String text) {
        send(to, subject, escapeHtml(text).replace("\n", "<br/>"));
    }

    @Override
    public void sendHtmlEmail(String to, String subject, String html) {
        send(to, subject, html);
    }

    private void send(String to, String subject, String html) {
        if (!mailEnabled) {
            log.info("Mail is disabled. Skipping email to={} subject={}", to, subject);
            return;
        }
        if (!StringUtils.hasText(to)) {
            log.warn("Cannot send email because recipient is blank subject={}", subject);
            return;
        }
        String resolvedApiKey = trim(apiKey);
        if (resolvedApiKey == null) {
            throw new IllegalStateException("RESEND_API_KEY is required when mail is enabled.");
        }
        String from = resolveFrom();
        try {
            Resend resend = new Resend(resolvedApiKey);
            CreateEmailOptions options = CreateEmailOptions.builder()
                    .from(from)
                    .to(to.trim())
                    .subject(subject)
                    .html(html)
                    .build();
            CreateEmailResponse response = resend.emails().send(options);
            log.info("Sent email via Resend id={} to={} subject={}", response.getId(), to, subject);
        } catch (ResendException exception) {
            log.error("Failed to send email via Resend to={} subject={} from={}", to, subject, from, exception);
            throw new IllegalStateException("Khong the gui email qua Resend.", exception);
        }
    }

    private String resolveFrom() {
        String configuredFrom = trim(resendFrom);
        if (configuredFrom != null) {
            return configuredFrom;
        }
        String address = trim(fromAddress);
        if (address == null) {
            throw new IllegalStateException("RESEND_FROM or MAIL_FROM_ADDRESS is required when mail is enabled.");
        }
        String name = trim(fromName);
        return name == null ? address : "%s <%s>".formatted(name, address);
    }

    private String trim(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
