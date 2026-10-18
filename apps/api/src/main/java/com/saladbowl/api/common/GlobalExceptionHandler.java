package com.saladbowl.api.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static ResponseEntity<ErrorResponse> error(ErrorCode code, String message) {
        return ResponseEntity.status(code.status()).body(new ErrorResponse(code.name(), message));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return error(e.code(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst()
                .orElse("invalid request");
        return error(ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleMethodValidation(HandlerMethodValidationException e) {
        return error(ErrorCode.VALIDATION_FAILED, "invalid request");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        return error(ErrorCode.VALIDATION_FAILED, "malformed request body");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return error(ErrorCode.VALIDATION_FAILED, "invalid value for parameter '" + e.getName() + "'");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException e) {
        return error(ErrorCode.UNSUPPORTED_MEDIA_TYPE, "unsupported media type");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return error(ErrorCode.METHOD_NOT_ALLOWED, "method not allowed");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
        return error(ErrorCode.NOT_FOUND, "resource not found");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return error(ErrorCode.FORBIDDEN, "access denied");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException e) {
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return error(ErrorCode.CONFLICT, "request conflicts with existing data");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        // Spring 예외 중 상당수(MissingServletRequestParameterException, ResponseStatusException 등)는
        // org.springframework.web.ErrorResponse를 구현하고 자기 status를 가진다. 이를 500으로 덮지 않는다.
        if (e instanceof org.springframework.web.ErrorResponse framework) {
            return frameworkError(framework, e);
        }
        log.error("Unhandled exception", e);
        return error(ErrorCode.INTERNAL_ERROR, "internal server error");
    }

    private static ResponseEntity<ErrorResponse> frameworkError(org.springframework.web.ErrorResponse framework,
                                                                Exception e) {
        HttpStatusCode status = framework.getStatusCode();
        if (status.is5xxServerError()) {
            log.error("Framework server error", e);
        }
        String code = switch (status.value()) {
            case 400 -> ErrorCode.VALIDATION_FAILED.name();
            case 401 -> ErrorCode.UNAUTHORIZED.name();
            case 403 -> ErrorCode.FORBIDDEN.name();
            case 404 -> ErrorCode.NOT_FOUND.name();
            case 405 -> ErrorCode.METHOD_NOT_ALLOWED.name();
            case 409 -> ErrorCode.CONFLICT.name();
            case 415 -> ErrorCode.UNSUPPORTED_MEDIA_TYPE.name();
            default -> status.is5xxServerError() ? ErrorCode.INTERNAL_ERROR.name() : "REQUEST_FAILED";
        };
        String detail = framework.getBody().getDetail();
        String message = status.is5xxServerError() || detail == null ? "request failed" : detail;
        return ResponseEntity.status(status).body(new ErrorResponse(code, message));
    }
}
