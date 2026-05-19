package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.BuyerBranchDtos;
import com.agribridge.backend.entity.BranchEntity;
import com.agribridge.backend.entity.OrderEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.OrderStatusEnum;
import com.agribridge.backend.entity.enums.RfqStatusEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.entity.enums.UserStatusEnum;
import com.agribridge.backend.exception.ApiException;
import com.agribridge.backend.repository.BranchRepository;
import com.agribridge.backend.repository.OrderRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.repository.UserRepository;
import com.agribridge.backend.service.BuyerBranchService;
import com.agribridge.backend.service.CurrentUserService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BuyerBranchServiceImpl implements BuyerBranchService {

    private static final List<OrderStatusEnum> ACTIVE_ORDER_STATUSES = List.of(
            OrderStatusEnum.PENDING,
            OrderStatusEnum.CONFIRMED,
            OrderStatusEnum.SHIPPING);
    private static final String VN_PHONE_PATTERN = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$";
    private static final String EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
    private static final int MIN_TEMP_PASSWORD_LENGTH = 8;

    private final CurrentUserService currentUserService;
    private final BranchRepository branchRepository;
    private final OrderRepository orderRepository;
    private final RfqRepository rfqRepository;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    @Transactional(readOnly = true)
    public List<BuyerBranchDtos.Summary> getBranches() {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        return branchRepository.findByCompanyIdOrderByCreatedAtDesc(buyerCompanyId).stream()
                .map(branch -> toSummary(branch, buyerCompanyId))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerBranchDtos.Detail getBranch(Long id) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        BranchEntity branch = requireBranch(id, buyerCompanyId);
        return new BuyerBranchDtos.Detail(
                toSummary(branch, buyerCompanyId),
                orderRepository.findTop5ByBuyerCompanyIdAndBranchIdOrderByCreatedAtDesc(buyerCompanyId, id).stream()
                        .map(this::toRecentOrder)
                        .toList(),
                rfqRepository.findTop5ByBuyerCompanyIdAndBranchIdOrderByCreatedAtDesc(buyerCompanyId, id).stream()
                        .map(this::toRecentRfq)
                        .toList(),
                userRepository.findByCompanyIdAndBranchIdOrderByCreatedAtDesc(buyerCompanyId, id).stream()
                        .map(this::toStaff)
                        .toList());
    }

    @Override
    @Transactional
    public BuyerBranchDtos.Summary createBranch(BuyerBranchDtos.UpsertRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        validateRequest(request, buyerCompanyId, null);
        LocalDateTime now = LocalDateTime.now();
        BranchEntity branch = BranchEntity.builder()
                .companyId(buyerCompanyId)
                .name(required(request.name(), "name is required"))
                .province(required(request.province(), "province is required"))
                .district(clean(request.district()))
                .ward(clean(request.ward()))
                .address(required(request.address(), "address is required"))
                .deliveryAddress(firstText(request.deliveryAddress(), request.address()))
                .managerName(clean(request.managerName()))
                .phone(clean(request.phone()))
                .isActive(request.isActive() == null ? Boolean.TRUE : request.isActive())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toSummary(branchRepository.save(branch), buyerCompanyId);
    }

    @Override
    @Transactional
    public BuyerBranchDtos.Summary updateBranch(Long id, BuyerBranchDtos.UpsertRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        BranchEntity branch = requireBranch(id, buyerCompanyId);
        validateRequest(request, buyerCompanyId, id);
        branch.setName(required(request.name(), "name is required"));
        branch.setProvince(required(request.province(), "province is required"));
        branch.setDistrict(clean(request.district()));
        branch.setWard(clean(request.ward()));
        branch.setAddress(required(request.address(), "address is required"));
        branch.setDeliveryAddress(firstText(request.deliveryAddress(), request.address()));
        branch.setManagerName(clean(request.managerName()));
        branch.setPhone(clean(request.phone()));
        branch.setIsActive(request.isActive() == null ? Boolean.TRUE : request.isActive());
        branch.setUpdatedAt(LocalDateTime.now());
        return toSummary(branchRepository.save(branch), buyerCompanyId);
    }

    @Override
    @Transactional
    public BuyerBranchDtos.Summary updateStatus(Long id, BuyerBranchDtos.StatusRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        BranchEntity branch = requireBranch(id, buyerCompanyId);
        if (request == null || request.isActive() == null) {
            throw new IllegalArgumentException("isActive is required");
        }
        branch.setIsActive(request.isActive());
        branch.setUpdatedAt(LocalDateTime.now());
        return toSummary(branchRepository.save(branch), buyerCompanyId);
    }

    @Override
    @Transactional
    public BuyerBranchDtos.Staff createEmployee(Long branchId, BuyerBranchDtos.EmployeeCreateRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        requireBranch(branchId, buyerCompanyId);
        if (request == null) {
            throw new IllegalArgumentException("employee payload is required");
        }

        String fullName = required(request.fullName(), "fullName is required");
        String email = normalizeEmail(request.email());
        String phone = normalizePhone(request.phone());
        String temporaryPassword = required(request.temporaryPassword(), "temporaryPassword is required");
        if (temporaryPassword.length() < MIN_TEMP_PASSWORD_LENGTH) {
            throw new IllegalArgumentException("temporary password must be at least 8 characters");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email is already in use: " + email);
        }
        if (userRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("Phone is already in use: " + phone);
        }

        UserStatusEnum status = Boolean.TRUE.equals(request.inviteOnly())
                ? UserStatusEnum.PENDING_INVITE
                : parseEmployeeStatus(request.status());
        UserEntity employee = UserEntity.builder()
                .companyId(buyerCompanyId)
                .branchId(branchId)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(temporaryPassword))
                .role(parseEmployeeRole(request.role()))
                .status(status)
                .createdAt(LocalDateTime.now())
                .build();
        return toStaff(userRepository.save(employee));
    }

    @Override
    @Transactional
    public BuyerBranchDtos.Staff assignEmployee(Long branchId, BuyerBranchDtos.EmployeeAssignRequest request) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        requireBranch(branchId, buyerCompanyId);
        if (request == null || request.userId() == null) {
            throw new IllegalArgumentException("userId is required");
        }
        UserEntity user = userRepository.findById(request.userId())
                .filter(candidate -> buyerCompanyId.equals(candidate.getCompanyId()))
                .orElseThrow(() -> new IllegalArgumentException("USER_NOT_FOUND_IN_BUYER_COMPANY"));
        user.setBranchId(branchId);
        user.setRole(parseEmployeeRole(request.role()));
        user.setStatus(parseEmployeeStatus(request.status()));
        return toStaff(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BuyerBranchDtos.Staff> getAssignableEmployees(Long branchId, String search) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        requireBranch(branchId, buyerCompanyId);
        String text = clean(search);
        String normalizedText = text == null ? null : text.toLowerCase(Locale.ROOT);
        return userRepository.findByCompanyIdAndBranchIdIsNullOrderByCreatedAtDesc(buyerCompanyId).stream()
                .filter(user -> user.getRole() != UserRoleEnum.ADMIN)
                .filter(user -> normalizedText == null || searchableUserText(user).contains(normalizedText))
                .map(this::toStaff)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BuyerBranchDtos.EmployeeAvailability checkEmployeeAvailability(String email, String phone) {
        String normalizedEmail = normalizeEmailOptional(email);
        String normalizedPhone = normalizePhoneOptional(phone);
        return new BuyerBranchDtos.EmployeeAvailability(
                normalizedPhone != null && userRepository.existsByPhone(normalizedPhone),
                normalizedEmail != null && userRepository.existsByEmailIgnoreCase(normalizedEmail));
    }

    @Override
    @Transactional
    public void deleteBranch(Long id) {
        Long buyerCompanyId = currentUserService.requireCurrentBuyerCompanyId();
        BranchEntity branch = requireBranch(id, buyerCompanyId);
        boolean hasUsage = orderRepository.existsByBranchId(id)
                || rfqRepository.existsByBranchId(id)
                || userRepository.existsByBranchId(id);
        if (hasUsage) {
            branch.setIsActive(false);
            branch.setUpdatedAt(LocalDateTime.now());
            branchRepository.save(branch);
            throw new ApiException(HttpStatus.CONFLICT, "BRANCH_HAS_USAGE_USE_DEACTIVATE");
        }
        branchRepository.delete(branch);
    }

    private void validateRequest(BuyerBranchDtos.UpsertRequest request, Long companyId, Long currentBranchId) {
        if (request == null) {
            throw new IllegalArgumentException("branch payload is required");
        }
        String name = required(request.name(), "name is required");
        required(request.province(), "province is required");
        required(request.address(), "address is required");
        String phone = clean(request.phone());
        if (phone != null && !phone.matches(VN_PHONE_PATTERN)) {
            throw new IllegalArgumentException("phone must be a valid Vietnamese phone number");
        }
        boolean nameExists = currentBranchId == null
                ? branchRepository.existsByCompanyIdAndNameIgnoreCase(companyId, name)
                : branchRepository.existsByCompanyIdAndNameIgnoreCaseAndIdNot(companyId, name, currentBranchId);
        if (nameExists) {
            throw new IllegalArgumentException("branch name already exists in this company");
        }
    }

    private BranchEntity requireBranch(Long id, Long companyId) {
        if (id == null) {
            throw new IllegalArgumentException("branch id is required");
        }
        return branchRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new IllegalArgumentException("BRANCH_NOT_FOUND"));
    }

    private BuyerBranchDtos.Summary toSummary(BranchEntity branch, Long buyerCompanyId) {
        LocalDate startDate = LocalDate.now().withDayOfMonth(1);
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = startDate.plusMonths(1).atStartOfDay();
        long activeOrders = orderRepository.countByBuyerCompanyIdAndBranchIdAndStatusIn(buyerCompanyId, branch.getId(), ACTIVE_ORDER_STATUSES);
        long monthlyOrderCount = orderRepository.countMonthlyByBranch(buyerCompanyId, branch.getId(), start, end);
        BigDecimal monthlyTotal = orderRepository.sumMonthlyTotalByBranch(buyerCompanyId, branch.getId(), start, end);
        long staffCount = userRepository.countByCompanyIdAndBranchId(buyerCompanyId, branch.getId());
        long openRfqCount = rfqRepository.countByBuyerCompanyIdAndBranchIdAndStatus(buyerCompanyId, branch.getId(), RfqStatusEnum.OPEN);
        return new BuyerBranchDtos.Summary(
                branch.getId(),
                "BR-" + branch.getId(),
                branch.getName(),
                branch.getProvince(),
                branch.getDistrict(),
                branch.getWard(),
                branch.getAddress(),
                branch.getDeliveryAddress(),
                branch.getManagerName(),
                branch.getPhone(),
                branch.getIsActive(),
                activeOrders + " đơn đang xử lý",
                activeOrders,
                monthlyOrderCount,
                monthlyTotal == null ? BigDecimal.ZERO : monthlyTotal,
                formatMoney(monthlyTotal),
                staffCount,
                openRfqCount,
                branch.getCreatedAt(),
                branch.getUpdatedAt());
    }

    private BuyerBranchDtos.RecentOrder toRecentOrder(OrderEntity order) {
        return new BuyerBranchDtos.RecentOrder(
                order.getId(),
                "ORD-" + order.getId(),
                order.getStatus().name(),
                order.getTotalAmount(),
                order.getCreatedAt());
    }

    private BuyerBranchDtos.RecentRfq toRecentRfq(RfqEntity rfq) {
        return new BuyerBranchDtos.RecentRfq(
                rfq.getId(),
                "RFQ-" + rfq.getId(),
                rfq.getTitle(),
                rfq.getStatus().name(),
                rfq.getQuantity(),
                rfq.getUnit(),
                rfq.getDeliveryDate(),
                rfq.getCreatedAt());
    }

    private BuyerBranchDtos.Staff toStaff(UserEntity user) {
        return new BuyerBranchDtos.Staff(
                user.getId(),
                user.getFullName(),
                user.getPhone(),
                user.getEmail(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getCreatedAt());
    }

    private UserRoleEnum parseEmployeeRole(String role) {
        String value = clean(role);
        if (value == null) {
            return UserRoleEnum.WAREHOUSE;
        }
        return switch (value.replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT)) {
            case "BRANCH_MANAGER", "MANAGER" -> UserRoleEnum.ORDER_STAFF;
            case "PURCHASER", "PURCHASE", "BUYER" -> UserRoleEnum.SALES;
            case "QC", "QUALITY_CONTROL" -> UserRoleEnum.QC;
            case "ACCOUNTANT", "ACCOUNTING" -> UserRoleEnum.ACCOUNTANT;
            case "WAREHOUSE", "WAREHOUSE_STAFF" -> UserRoleEnum.WAREHOUSE;
            default -> UserRoleEnum.WAREHOUSE;
        };
    }

    private UserStatusEnum parseEmployeeStatus(String status) {
        String value = clean(status);
        if (value == null) {
            return UserStatusEnum.ACTIVE;
        }
        return switch (value.replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT)) {
            case "BLOCKED", "LOCKED", "SUSPENDED" -> UserStatusEnum.BLOCKED;
            case "PENDING", "PENDING_INVITE", "INVITED" -> UserStatusEnum.PENDING_INVITE;
            default -> UserStatusEnum.ACTIVE;
        };
    }

    private String normalizeEmail(String email) {
        String normalized = normalizeEmailOptional(email);
        if (normalized == null) {
            throw new IllegalArgumentException("email is required");
        }
        if (!normalized.matches(EMAIL_PATTERN)) {
            throw new IllegalArgumentException("email must be valid");
        }
        return normalized;
    }

    private String normalizeEmailOptional(String email) {
        String normalized = clean(email);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String phone) {
        String normalized = normalizePhoneOptional(phone);
        if (normalized == null) {
            throw new IllegalArgumentException("phone is required");
        }
        if (!normalized.matches(VN_PHONE_PATTERN)) {
            throw new IllegalArgumentException("phone must be a valid Vietnamese phone number");
        }
        return normalized;
    }

    private String normalizePhoneOptional(String phone) {
        String normalized = clean(phone);
        if (normalized == null) {
            return null;
        }
        return normalized.replaceAll("[^0-9+]", "");
    }

    private String searchableUserText(UserEntity user) {
        return String.join(" ",
                user.getFullName() == null ? "" : user.getFullName(),
                user.getEmail() == null ? "" : user.getEmail(),
                user.getPhone() == null ? "" : user.getPhone(),
                user.getRole() == null ? "" : user.getRole().name()).toLowerCase(Locale.ROOT);
    }

    private String required(String value, String message) {
        String cleaned = clean(value);
        if (cleaned == null) {
            throw new IllegalArgumentException(message);
        }
        return cleaned;
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String firstText(String first, String fallback) {
        String cleaned = clean(first);
        return cleaned == null ? required(fallback, "deliveryAddress is required") : cleaned;
    }

    private String formatMoney(BigDecimal value) {
        return String.format(Locale.US, "%,.0f", value == null ? BigDecimal.ZERO : value) + "đ";
    }
}
