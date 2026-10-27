package com.saladbowl.api.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    INVITE_NOT_FOUND(HttpStatus.NOT_FOUND),
    INVITE_EXPIRED(HttpStatus.GONE),
    ALREADY_MEMBER(HttpStatus.CONFLICT),
    GROUP_FULL(HttpStatus.CONFLICT),
    CANNOT_REMOVE_ADMIN(HttpStatus.CONFLICT),
    ADMIN_CANNOT_LEAVE(HttpStatus.CONFLICT),
    REMOVED_FROM_GROUP(HttpStatus.FORBIDDEN),
    INVALID_FILE_FORMAT(HttpStatus.BAD_REQUEST),
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE),
    CANNOT_DELETE_IMPORTED(HttpStatus.CONFLICT),
    IMPORT_PERIOD_TOO_LONG(HttpStatus.BAD_REQUEST),
    IMPORT_BUSY(HttpStatus.SERVICE_UNAVAILABLE),
    CONFLICT(HttpStatus.CONFLICT),
    /** 개별 코드가 없는 4xx용. enum의 status는 대표값이고, 실제 응답 status는 원래 예외의 것을 쓴다. */
    REQUEST_FAILED(HttpStatus.BAD_REQUEST),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
