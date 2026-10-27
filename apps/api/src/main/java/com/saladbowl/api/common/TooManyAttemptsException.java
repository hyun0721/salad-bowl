package com.saladbowl.api.common;

/** 429 응답의 Retry-After(초)를 함께 나르는 예외. */
public class TooManyAttemptsException extends ApiException {

    private final long retryAfterSeconds;

    public TooManyAttemptsException(long retryAfterSeconds) {
        super(ErrorCode.TOO_MANY_ATTEMPTS, "too many login attempts");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
