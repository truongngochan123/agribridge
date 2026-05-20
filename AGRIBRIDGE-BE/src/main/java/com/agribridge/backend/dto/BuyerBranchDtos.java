package com.agribridge.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class BuyerBranchDtos {

    private BuyerBranchDtos() {
    }

    public record UpsertRequest(
            String name,
            String province,
            String district,
            String ward,
            String address,
            String deliveryAddress,
            String managerName,
            String phone,
            Boolean isActive
    ) {
    }

    public record StatusRequest(Boolean isActive) {
    }

    public record EmployeeCreateRequest(
            String fullName,
            String email,
            String phone,
            String temporaryPassword,
            String role,
            String status,
            Boolean inviteOnly
    ) {
    }

    public record EmployeeAssignRequest(
            Long userId,
            String role,
            String status
    ) {
    }

    public record EmployeeAvailability(
            boolean phoneTaken,
            boolean emailTaken
    ) {
    }

    public record Summary(
            Long rawId,
            String id,
            String name,
            String province,
            String district,
            String ward,
            String address,
            String deliveryAddress,
            String managerName,
            String phone,
            Boolean isActive,
            String activeOrders,
            long activeOrderCount,
            long monthlyOrderCount,
            BigDecimal monthlyTotalAmount,
            String monthlyVolume,
            long staffCount,
            long openRfqCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record Detail(
            Summary branch,
            List<RecentOrder> recentOrders,
            List<RecentRfq> recentRfqs,
            List<Staff> staff
    ) {
    }

    public record RecentOrder(
            Long rawId,
            String id,
            String status,
            BigDecimal totalAmount,
            LocalDateTime createdAt
    ) {
    }

    public record RecentRfq(
            Long rawId,
            String id,
            String title,
            String status,
            BigDecimal quantity,
            String unit,
            LocalDate deliveryDate,
            LocalDateTime createdAt
    ) {
    }

    public record Staff(
            Long id,
            String fullName,
            String phone,
            String email,
            String role,
            String status,
            LocalDateTime createdAt
    ) {
    }
}
