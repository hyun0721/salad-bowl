package com.saladbowl.api.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 시도 횟수 제한. 이메일(5회)과 IP(20회) 각각 첫 시도부터 15분 고정 창이다.
 * 실패 횟수가 아니라 "성공하지 못한 시도"를 센다: 비밀번호 확인 전에 자리를 먼저 예약하고, 성공하면 이메일 몫을 돌려준다.
 * 그래야 동시 요청이 검사와 기록 사이를 비집고 한도를 넘지 못한다.
 * shortcut: 서버 메모리·인스턴스 1대 기준이고 재시작하면 초기화된다. 인스턴스가 늘면 Redis 등 공유 저장소로 바꾼다.
 * shortcut: 가득 차면 오래된 창부터 지우므로 대량의 서로 다른 키로 다른 항목의 카운터를 밀어낼 수 있다. 실제 남용이 보이면 공유 저장소와 IP 단위 상한으로 바꾼다.
 */
@Component
public class LoginAttemptLimiter {

    static final Duration WINDOW = Duration.ofMinutes(15);
    static final int EMAIL_LIMIT = 5;
    static final int IP_LIMIT = 20;
    static final int MAX_ENTRIES = 50_000;
    private static final int EVICT_PERCENT = 10;

    private record Window(Instant start, int count) {
    }

    private final Clock clock;
    private final int maxEntries;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptLimiter(Clock clock) {
        this(clock, MAX_ENTRIES);
    }

    LoginAttemptLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.maxEntries = maxEntries;
    }

    /** 시도 자리를 예약한다. 예약했으면 0, 막혔으면 남은 초(올림, 1 이상)를 돌려준다. */
    public long tryAcquire(String email, String ip) {
        long blocked = acquire("e:" + email, EMAIL_LIMIT);
        if (blocked > 0) {
            return blocked;
        }
        blocked = acquire("i:" + ip, IP_LIMIT);
        if (blocked > 0) {
            // IP에서 막힌 요청은 이메일 몫을 쓰지 않은 것으로 돌린다.
            windows.computeIfPresent("e:" + email, (k, w) -> w.count() > 1 ? new Window(w.start(), w.count() - 1) : null);
        }
        return blocked;
    }

    /** 성공하면 이메일 카운터를 지우고 IP는 이 시도의 몫 하나만 돌려준다(앞선 실패는 남겨 여러 계정 대입을 막는다). */
    public void recordSuccess(String email, String ip) {
        windows.remove("e:" + email);
        windows.computeIfPresent("i:" + ip, (k, w) -> w.count() > 1 ? new Window(w.start(), w.count() - 1) : null);
    }

    private long acquire(String key, int limit) {
        Instant now = clock.instant();
        if (windows.size() >= maxEntries && !windows.containsKey(key)) {
            evictOldest(now);
        }
        long[] retry = {0};
        windows.compute(key, (k, cur) -> {
            if (cur == null || expired(cur, now)) {
                return new Window(now, 1);
            }
            if (cur.count() >= limit) {
                long nanos = Duration.between(now, cur.start().plus(WINDOW)).toNanos();
                retry[0] = Math.max(1, (nanos + 999_999_999L) / 1_000_000_000L);
                return cur;
            }
            return new Window(cur.start(), cur.count() + 1);
        });
        return retry[0];
    }

    /** 만료된 것을 먼저 지우고, 그래도 가득이면 창 시작이 가장 오래된 10%를 지워 새 키 자리를 만든다. */
    private void evictOldest(Instant now) {
        windows.entrySet().removeIf(e -> expired(e.getValue(), now));
        if (windows.size() < maxEntries) {
            return;
        }
        long n = Math.max(1, (long) maxEntries * EVICT_PERCENT / 100);
        windows.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<String, Window> e) -> e.getValue().start()))
                .limit(n)
                .map(Map.Entry::getKey)
                .toList()
                .forEach(windows::remove);
    }

    private static boolean expired(Window w, Instant now) {
        return !now.isBefore(w.start().plus(WINDOW));
    }
}
