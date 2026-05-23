package com.agribridge.backend.service;

public interface OutboundEmailService {

    void sendTextEmail(String to, String subject, String text);

    void sendHtmlEmail(String to, String subject, String html);
}
