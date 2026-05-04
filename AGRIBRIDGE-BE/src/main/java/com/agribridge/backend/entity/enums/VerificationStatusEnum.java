package com.agribridge.backend.entity.enums;

public enum VerificationStatusEnum {
    // Legacy values – kept for backward compat with existing admin/resubmit flow
    PENDING,
    APPROVED,
    REJECTED,
    NEED_MORE_INFO,

    // New values for auto-verification flow
    DRAFT,
    PENDING_REVIEW,
    AUTO_APPROVED,
    MANUAL_APPROVED,
    NEEDS_MORE_INFO
}