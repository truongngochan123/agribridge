package com.agribridge.backend.service.impl;

import com.agribridge.backend.dto.RfqMessageDto;
import com.agribridge.backend.dto.SendRfqMessageDto;
import com.agribridge.backend.entity.CompanyEntity;
import com.agribridge.backend.entity.ProductEntity;
import com.agribridge.backend.entity.RfqEntity;
import com.agribridge.backend.entity.RfqMessageEntity;
import com.agribridge.backend.entity.UserEntity;
import com.agribridge.backend.entity.enums.CompanyTypeEnum;
import com.agribridge.backend.entity.enums.UserRoleEnum;
import com.agribridge.backend.exception.ApiException;
import com.agribridge.backend.repository.CompanyRepository;
import com.agribridge.backend.repository.ProductRepository;
import com.agribridge.backend.repository.QuoteRepository;
import com.agribridge.backend.repository.RfqMessageRepository;
import com.agribridge.backend.repository.RfqRepository;
import com.agribridge.backend.service.CurrentUserService;
import com.agribridge.backend.service.RfqMessageService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RfqMessageServiceImpl implements RfqMessageService {

    private static final int MAX_MESSAGE_LENGTH = 2_000;

    private final RfqMessageRepository rfqMessageRepository;
    private final RfqRepository rfqRepository;
    private final QuoteRepository quoteRepository;
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;
    private final CurrentUserService currentUserService;

    @Override
    @Transactional(readOnly = true)
    public List<RfqMessageDto> getMessagesByRfq(Long rfqId) {
        validateRfqExists(rfqId);
        return rfqMessageRepository.findByRfqIdOrderByCreatedAtAsc(rfqId).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RfqMessageDto> getMessagesForCurrentUser(Long rfqId, Long supplierCompanyId) {
        RfqConversation conversation = requireAccessibleConversation(rfqId, supplierCompanyId);
        return rfqMessageRepository.findByRfqIdAndSupplierCompanyIdOrderByCreatedAtAsc(
                        conversation.rfq().getId(),
                        conversation.supplierCompanyId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public RfqMessageDto saveMessage(SendRfqMessageDto request) {
        validateRfqExists(request.rfqId());

        String message = normalizeMessage(request.message());
        String senderRole = normalizeSenderRole(request.senderRole());

        RfqMessageEntity saved = rfqMessageRepository.save(RfqMessageEntity.builder()
                .rfqId(Objects.requireNonNull(request.rfqId()))
                .senderUserId(Objects.requireNonNull(request.senderUserId()))
                .senderCompanyId(Objects.requireNonNull(request.senderCompanyId()))
                .senderRole(senderRole)
                .message(message)
                .createdAt(LocalDateTime.now())
                .build());

        return toDto(saved);
    }

    @Override
    @Transactional
    public RfqMessageDto saveMessageForCurrentUser(Long rfqId, Long supplierCompanyId, String rawMessage) {
        RfqConversation conversation = requireAccessibleConversation(rfqId, supplierCompanyId);
        UserEntity user = currentUserService.requireCurrentUser();
        CompanyEntity company = requireUserCompany(user);
        String senderRole = senderRole(user, company);
        String message = normalizeMessage(rawMessage);

        RfqMessageEntity saved = rfqMessageRepository.save(RfqMessageEntity.builder()
                .rfqId(conversation.rfq().getId())
                .supplierCompanyId(conversation.supplierCompanyId())
                .senderUserId(user.getId())
                .senderCompanyId(company.getId())
                .senderRole(senderRole)
                .message(message)
                .createdAt(LocalDateTime.now())
                .build());

        return toDto(saved);
    }

    private void validateRfqExists(Long rfqId) {
        if (rfqId == null || !rfqRepository.existsById(rfqId)) {
            throw new IllegalArgumentException("RFQ does not exist");
        }
    }

    private RfqConversation requireAccessibleConversation(Long rfqId, Long requestedSupplierCompanyId) {
        if (rfqId == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "RFQ_NOT_FOUND");
        }
        RfqEntity rfq = rfqRepository.findById(rfqId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RFQ_NOT_FOUND"));
        UserEntity user = currentUserService.requireCurrentUser();
        CompanyEntity company = requireUserCompany(user);
        Long supplierCompanyId = resolveSupplierCompanyId(rfq, requestedSupplierCompanyId, company);

        if (UserRoleEnum.ADMIN.equals(user.getRole())) {
            return new RfqConversation(rfq, supplierCompanyId);
        }
        if (CompanyTypeEnum.BUYER.equals(company.getCompanyType())
                && Objects.equals(rfq.getBuyerCompanyId(), company.getId())
                && supplierCanAccess(rfq, supplierCompanyId)) {
            return new RfqConversation(rfq, supplierCompanyId);
        }
        if (CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType())
                && Objects.equals(supplierCompanyId, company.getId())
                && supplierCanAccess(rfq, company.getId())) {
            return new RfqConversation(rfq, supplierCompanyId);
        }

        throw new ApiException(HttpStatus.FORBIDDEN, "RFQ_CHAT_FORBIDDEN");
    }

    private Long resolveSupplierCompanyId(RfqEntity rfq, Long requestedSupplierCompanyId, CompanyEntity currentCompany) {
        if (CompanyTypeEnum.SUPPLIER.equals(currentCompany.getCompanyType())) {
            return currentCompany.getId();
        }
        Long supplierCompanyId = requestedSupplierCompanyId == null ? rfq.getSupplierCompanyId() : requestedSupplierCompanyId;
        if (supplierCompanyId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SUPPLIER_COMPANY_ID_REQUIRED");
        }
        return supplierCompanyId;
    }

    private CompanyEntity requireUserCompany(UserEntity user) {
        if (user.getCompanyId() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_HAS_NO_COMPANY");
        }
        return companyRepository.findById(user.getCompanyId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "COMPANY_NOT_FOUND"));
    }

    private boolean supplierCanAccess(RfqEntity rfq, Long supplierCompanyId) {
        if (Objects.equals(rfq.getSupplierCompanyId(), supplierCompanyId)) {
            return true;
        }
        if (quoteRepository.findTopBySupplierCompanyIdAndRfqIdOrderByCreatedAtDesc(supplierCompanyId, rfq.getId()).isPresent()) {
            return true;
        }

        List<ProductEntity> products = productRepository.findBySupplierCompanyId(supplierCompanyId);
        return products.stream().anyMatch(product ->
                Objects.equals(product.getId(), rfq.getProductId())
                        || Objects.equals(product.getCategoryId(), rfq.getCategoryId())
                        || sameText(product.getOriginProvince(), rfq.getProvince()));
    }

    private boolean sameText(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private String senderRole(UserEntity user, CompanyEntity company) {
        if (UserRoleEnum.ADMIN.equals(user.getRole())) {
            return "ADMIN";
        }
        if (CompanyTypeEnum.BUYER.equals(company.getCompanyType())) {
            return "BUYER";
        }
        if (CompanyTypeEnum.SUPPLIER.equals(company.getCompanyType())) {
            return "SUPPLIER";
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "UNSUPPORTED_COMPANY_TYPE");
    }

    private String normalizeMessage(String rawMessage) {
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message must be at most " + MAX_MESSAGE_LENGTH + " characters");
        }
        return message;
    }

    private String normalizeSenderRole(String rawSenderRole) {
        String senderRole = rawSenderRole == null ? "" : rawSenderRole.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("BUYER", "SUPPLIER", "ADMIN").contains(senderRole)) {
            throw new IllegalArgumentException("Sender role is invalid");
        }
        return senderRole;
    }

    private RfqMessageDto toDto(RfqMessageEntity entity) {
        return new RfqMessageDto(
                entity.getId(),
                entity.getRfqId(),
                entity.getSupplierCompanyId(),
                entity.getSenderUserId(),
                entity.getSenderCompanyId(),
                entity.getSenderRole(),
                entity.getMessage(),
                entity.getCreatedAt());
    }

    private record RfqConversation(RfqEntity rfq, Long supplierCompanyId) {
    }
}
