package com.saladbowl.api.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 시도 횟수 제한. 모두 첫 시도부터 15분 고정 창이다.
 * (이메일, IP) 쌍 5회, IP 20회, 이메일 전체 50회. 쌍 한도 덕에 남이 내 이메일을 틀려도 다른 IP의 나는 로그인되고,
 * 이메일 전체 한도는 IP를 바꿔 가며 대입하는 공격의 상한이다.
 * 실패 횟수가 아니라 "성공하지 못한 시도"를 센다: 비밀번호 확인 전에 자리를 먼저 예약하고 성공하면 돌려준다.
 * 그래야 동시 요청이 검사와 기록 사이를 비집고 한도를 넘지 못한다.
 * shortcut: 서버 메모리·인스턴스 1대 기준이고 재시작하면 초기화된다. 인스턴스가 늘면 Redis 등 공유 저장소로 바꾼다.
 * shortcut: 가득 차면 새 키를 기록하지 않고 거절한다(fail-closed). 대량의 서로 다른 IP로 신규 로그인을 거절시킬 수 있다. 실제 남용이 보이면 공유 저장소와 IP 단위 총량 제한으로 바꾼다.
 */
@Component
public class LoginAttemptLimiter {

    static final Duration WINDOW = Duration.ofMinutes(15);
    static final int PAIR_LIMIT = 5;
    static final int IP_LIMIT = 20;
    static final int EMAIL_LIMIT = 50;
    static final int MAX_ENTRIES = 50_000;
    /** 만료 항목 정리는 이 간격으로만 한다(요청마다 전체를 훑지 않는다). */
    private static final Duration SWEEP_INTERVAL = Duration.ofMinutes(1);
    private static final long FULL_RETRY_SECONDS = 60;

    private record Window(Instant start, int count) {
    }

    private final Clock clock;
    private final int maxEntries;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private volatile Instant lastSweep;

    @Autowired
    public LoginAttemptLimiter(Clock clock) {
        this(clock, MAX_ENTRIES);
    }

    LoginAttemptLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.maxEntries = maxEntries;
        this.lastSweep = clock.instant();
    }

    /** 시도 자리를 예약한다. 예약했으면 0, 막혔으면 남은 초(올림, 1 이상)를 돌려준다. */
    public long tryAcquire(String email, String ip) {
        String pair = "p:" + email + "|" + ip;
        String ipKey = "i:" + ip;
        String emailKey = "e:" + email;
        List<String> keys = List.of(pair, ipKey, emailKey);
        List<Integer> limits = List.of(PAIR_LIMIT, IP_LIMIT, EMAIL_LIMIT);
        for (int i = 0; i < keys.size(); i++) {
            long blocked = acquire(keys.get(i), limits.get(i));
            if (blocked > 0) {
                // 앞서 예약한 몫은 쓰지 않은 것으로 돌린다.
                for (int j = 0; j < i; j++) {
                    release(keys.get(j));
                }
                return blocked;
            }
        }
        return 0;
    }

    /** 성공하면 그 (이메일, IP)와 이메일 전체를 지우고 IP는 이번 시도 몫만 돌려준다(앞선 실패는 남겨 여러 계정 대입을 막는다). */
    public void recordSuccess(String email, String ip) {
        windows.remove("p:" + email + "|" + ip);
        windows.remove("e:" + email);
        release("i:" + ip);
    }

    private long acquire(String key, int limit) {
        Instant now = clock.instant();
        sweepIfDue(now);
        long[] retry = {0};
        windows.compute(key, (k, cur) -> {
            if (cur == null || expired(cur, now)) {
                if (cur == null && windows.size() >= maxEntries) {
                    retry[0] = FULL_RETRY_SECONDS;
                    return null;
                }
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

    private void release(String key) {
        windows.computeIfPresent(key, (k, w) -> w.count() > 1 ? new Window(w.start(), w.count() - 1) : null);
    }

    /** 만료 항목은 간격이 지났을 때만 지운다. 미만료 항목은 새 키 때문에 지우지 않는다. */
    private void sweepIfDue(Instant now) {
        if (now.isBefore(lastSweep.plus(SWEEP_INTERVAL))) {
            return;
        }
        lastSweep = now;
        windows.entrySet().removeIf(e -> expired(e.getValue(), now));
    }

    private static boolean expired(Window w, Instant now) {
        return !now.isBefore(w.start().plus(WINDOW));
    }
}
