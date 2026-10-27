package com.saladbowl.api.auth;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 실패 횟수 제한. 이메일(5회)과 IP(20회) 각각 첫 실패부터 15분 고정 창이다.
 * shortcut: 서버 메모리·인스턴스 1대 기준이고 재시작하면 초기화된다. 인스턴스가 늘면 Redis 등 공유 저장소로 바꾼다.
 */
@Component
public class LoginAttemptLimiter {

    static final Duration WINDOW = Duration.ofMinutes(15);
    static final int EMAIL_LIMIT = 5;
    static final int IP_LIMIT = 20;
    static final int MAX_ENTRIES = 10_000;

    private record Window(Instant start, int count) {
    }

    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public LoginAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** 막혀 있으면 남은 초(올림, 1 이상)를, 아니면 0을 돌려준다. */
    public long retryAfterSeconds(String email, String ip) {
        return Math.max(remaining("e:" + email, EMAIL_LIMIT), remaining("i:" + ip, IP_LIMIT));
    }

    public void recordFailure(String email, String ip) {
        increment("e:" + email);
        increment("i:" + ip);
    }

    /** 성공 시 이메일만 지운다. IP는 한 IP의 여러 계정 대입을 막으려 남긴다. */
    public void clearEmail(String email) {
        windows.remove("e:" + email);
    }

    private long remaining(String key, int limit) {
        Instant now = clock.instant();
        Window w = windows.computeIfPresent(key, (k, cur) -> expired(cur, now) ? null : cur);
        if (w == null || w.count() < limit) {
            return 0;
        }
        long millis = Duration.between(now, w.start().plus(WINDOW)).toMillis();
        return Math.max(1, (millis + 999) / 1000);
    }

    private void increment(String key) {
        Instant now = clock.instant();
        if (windows.size() >= MAX_ENTRIES) {
            windows.entrySet().removeIf(e -> expired(e.getValue(), now));
            // shortcut: 정리 뒤에도 가득 차면 새 키는 세지 않는다(메모리 보호가 우선), 서비스가 커지면 공유 저장소로 옮기며 해결한다.
            if (windows.size() >= MAX_ENTRIES && !windows.containsKey(key)) {
                return;
            }
        }
        windows.compute(key, (k, cur) ->
                cur == null || expired(cur, now) ? new Window(now, 1) : new Window(cur.start(), cur.count() + 1));
    }

    private static boolean expired(Window w, Instant now) {
        return !now.isBefore(w.start().plus(WINDOW));
    }
}
