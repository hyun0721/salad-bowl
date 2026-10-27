package com.saladbowl.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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
    void concurrentAttemptsOnOneEmailNeverExceedLimit() throws Exception {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        int threads = 20;
        AtomicInteger passed = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        for (int i = 0; i < threads; i++) {
            String ip = "10.0.0." + i;
            pool.submit(() -> {
                start.await();
                if (limiter.tryAcquire("a@t.com", ip) == 0) {
                    passed.incrementAndGet();
                }
                return null;
            });
        }
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();

        assertThat(passed.get()).isEqualTo(LoginAttemptLimiter.EMAIL_LIMIT);
    }

    @Test
    void newKeysStillCountedAndBlockedWhenMapIsFull() {
        TestClock clock = new TestClock();
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock, 20);
        for (int i = 0; i < 50; i++) {
            limiter.tryAcquire("fill" + i + "@t.com", "ip" + i);
        }
        clock.now = clock.now.plusSeconds(1); // 채워 둔 항목이 더 오래된 것이 되게 한다

        for (int i = 0; i < LoginAttemptLimiter.EMAIL_LIMIT; i++) {
            assertThat(limiter.tryAcquire("new@t.com", "ipx" + i)).isZero();
        }
        assertThat(limiter.tryAcquire("new@t.com", "ipy")).isPositive();
    }

    @Test
    void retryAfterRoundsUpFromNanos() {
        TestClock clock = new TestClock();
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(clock);
        for (int i = 0; i < LoginAttemptLimiter.EMAIL_LIMIT; i++) {
            limiter.tryAcquire("a@t.com", "ip" + i);
        }
        clock.now = clock.now.plus(LoginAttemptLimiter.WINDOW).minusSeconds(1).minusNanos(1);

        assertThat(limiter.tryAcquire("a@t.com", "ipz")).isEqualTo(2);
    }

    @Test
    void successFreesEmailAndOwnIpSlot() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter(new TestClock());
        for (int i = 0; i < LoginAttemptLimiter.EMAIL_LIMIT; i++) {
            assertThat(limiter.tryAcquire("a@t.com", "ip")).isZero();
        }
        limiter.recordSuccess("a@t.com", "ip");

        assertThat(limiter.tryAcquire("a@t.com", "ip")).isZero();
        assertThat(Duration.ofMinutes(15)).isEqualTo(LoginAttemptLimiter.WINDOW);
    }
}
