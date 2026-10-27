package com.saladbowl.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptLimiterTest {

    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void concurrentAttemptsOnOnePairNeverExceedLimit() throws Exception {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        int threads = 20;
        AtomicInteger passed = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                start.await();
                if (limiter.tryAcquire("a@t.com", "10.0.0.1") == 0) {
                    passed.incrementAndGet();
                }
                return null;
            });
        }
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        assertThat(passed.get()).isEqualTo(LoginAttemptLimiter.PAIR_LIMIT);
    }

    @Test
    void otherIpIsNotBlockedByPairLimitButEmailTotalCaps() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        for (int i = 0; i < LoginAttemptLimiter.PAIR_LIMIT; i++) {
            limiter.tryAcquire("a@t.com", "ip1");
        }
        assertThat(limiter.tryAcquire("a@t.com", "ip1")).isPositive();
        assertThat(limiter.tryAcquire("a@t.com", "ip2")).isZero();

        // 이메일 전체 50회: 이미 6번 썼고 IP를 바꿔 가며 계속 시도
        int ok = 0;
        for (int i = 0; i < 100; i++) {
            if (limiter.tryAcquire("a@t.com", "x" + i) == 0) {
                ok++;
            }
        }
        assertThat(ok).isEqualTo(LoginAttemptLimiter.EMAIL_LIMIT - 6);
    }

    @Test
    void rejectedAttemptDoesNotConsumeEarlierKeys() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        for (int i = 0; i < LoginAttemptLimiter.IP_LIMIT; i++) {
            limiter.tryAcquire("u" + i + "@t.com", "ip");
        }
        for (int i = 0; i < 10; i++) {
            assertThat(limiter.tryAcquire("victim@t.com", "ip")).isPositive();
        }

        // 막힌 시도가 victim의 쌍 몫을 갉아먹지 않았으므로 다른 IP에서는 5회 모두 가능
        for (int i = 0; i < LoginAttemptLimiter.PAIR_LIMIT; i++) {
            assertThat(limiter.tryAcquire("victim@t.com", "other")).isZero();
        }
    }

    @Test
    void fullMapRejectsNewKeysAndKeepsUnexpiredOnes() {
        TestClock clock = new TestClock();
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock, 30);
        for (int i = 0; i < LoginAttemptLimiter.PAIR_LIMIT; i++) {
            limiter.tryAcquire("victim@t.com", "ipv");
        }
        for (int i = 0; i < 40; i++) {
            limiter.tryAcquire("fill" + i + "@t.com", "ip" + i);
        }

        assertThat(limiter.tryAcquire("brand-new@t.com", "ipn")).isPositive();
        // 피해자 카운터는 밀려나지 않았다
        assertThat(limiter.tryAcquire("victim@t.com", "ipv")).isPositive();
    }

    @Test
    void expiredEntriesAreSweptSoNewKeysFitAgain() {
        TestClock clock = new TestClock();
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock, 6);
        for (int i = 0; i < 10; i++) {
            limiter.tryAcquire("fill" + i + "@t.com", "ip" + i);
        }
        clock.now = clock.now.plus(LoginAttemptLimiter.WINDOW).plusSeconds(1);

        assertThat(limiter.tryAcquire("new@t.com", "ipn")).isZero();
    }

    @Test
    void retryAfterRoundsUpFromNanos() {
        TestClock clock = new TestClock();
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);
        for (int i = 0; i < LoginAttemptLimiter.PAIR_LIMIT; i++) {
            limiter.tryAcquire("a@t.com", "ip");
        }
        clock.now = clock.now.plus(LoginAttemptLimiter.WINDOW).minusSeconds(1).minusNanos(1);

        assertThat(limiter.tryAcquire("a@t.com", "ip")).isEqualTo(2);
    }

    @Test
    void successFreesPairEmailAndOwnIpSlot() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        for (int i = 0; i < LoginAttemptLimiter.PAIR_LIMIT; i++) {
            assertThat(limiter.tryAcquire("a@t.com", "ip")).isZero();
        }
        limiter.recordSuccess("a@t.com", "ip");

        assertThat(limiter.tryAcquire("a@t.com", "ip")).isZero();
    }
}
