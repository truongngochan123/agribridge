package com.agribridge.backend.config;

import com.agribridge.backend.dto.ErrorResponseDto;
import com.agribridge.backend.exception.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final Pattern SQL_SERVER_TABLE_COLUMN_PATTERN =
            Pattern.compile("table \"([^\"]+)\", column '([^']+)'", Pattern.CASE_INSENSITIVE);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDto> handleValidationException(MethodArgumentNotValidException exception) {
        Map<String, String> errors = new LinkedHashMap<>();

        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        String message = errors.values().stream()
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse("Validation failed");

        ErrorResponseDto payload = ErrorResponseDto.builder()
                .message(message)
                .errors(errors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(payload);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponseDto> handleIllegalArgumentException(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponseDto.of(exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponseDto> handleIllegalStateException(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ErrorResponseDto.of(exception.getMessage()));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponseDto> handleApiException(ApiException exception) {
        return ResponseEntity.status(exception.getStatus()).body(ErrorResponseDto.of(exception.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponseDto> handleDataIntegrityViolationException(
            DataIntegrityViolationException exception) {
        log.warn("Data integrity violation", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponseDto.of(resolveDataIntegrityMessage(exception)));
    }

    private String resolveDataIntegrityMessage(DataIntegrityViolationException exception) {
        Throwable mostSpecificCause = exception.getMostSpecificCause();
        String detail = mostSpecificCause == null ? "" : String.valueOf(mostSpecificCause.getMessage()).toLowerCase();

        if (detail.contains("insert") && detail.contains("orders") && detail.contains("status")) {
            return "Trạng thái đơn hàng không hợp lệ với ràng buộc dữ liệu hiện tại.";
        }
        if (detail.contains("insert") && detail.contains("invoices") && detail.contains("status")) {
            return "Trạng thái hóa đơn không hợp lệ với ràng buộc dữ liệu hiện tại.";
        }
        if (detail.contains("insert") && detail.contains("shipments") && detail.contains("status")) {
            return "Trạng thái vận chuyển không hợp lệ với ràng buộc dữ liệu hiện tại.";
        }
        if (detail.contains("delete") || detail.contains("reference") || detail.contains("foreign key")) {
            return "Không thể xóa dữ liệu vì đã có thông tin liên kết.";
        }
        if (detail.contains("duplicate") || detail.contains("unique")) {
            return "Dữ liệu đã tồn tại hoặc bị trùng với thông tin hiện có.";
        }

        String constraintTarget = readSqlServerConstraintTarget(mostSpecificCause);
        if (constraintTarget != null) {
            return "Dữ liệu vi phạm ràng buộc tại " + constraintTarget + ".";
        }

        return "Dữ liệu không hợp lệ hoặc vi phạm ràng buộc trong hệ thống.";
    }

    private String readSqlServerConstraintTarget(Throwable cause) {
        if (cause == null || cause.getMessage() == null) {
            return null;
        }

        Matcher matcher = SQL_SERVER_TABLE_COLUMN_PATTERN.matcher(cause.getMessage());
        if (!matcher.find()) {
            return null;
        }

        return "bảng " + matcher.group(1) + ", cột " + matcher.group(2);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponseDto> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ErrorResponseDto.of("Tep tai len vuot qua gioi han kich thuoc cho phep"));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponseDto> handleMultipartException(MultipartException exception) {
        String message = exception.getMessage();
        if (message != null && message.toLowerCase().contains("size")) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ErrorResponseDto.of("Tep tai len vuot qua gioi han kich thuoc cho phep"));
        }

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponseDto.of("Yeu cau tai tep khong hop le"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponseDto> handleMethodArgumentTypeMismatch(
            MethodArgumentTypeMismatchException exception) {
        String parameterName = exception.getName() == null ? "request parameter" : exception.getName();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponseDto.of("Invalid value for " + parameterName));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDto> handleGenericException(Exception exception) {
        log.error("Unhandled exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponseDto.of("Unexpected server error"));
    }
}
