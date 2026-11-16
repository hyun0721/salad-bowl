package com.saladbowl.api.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * 통합 테스트용 고정 시계. 연도 기록은 "올해·전년도·다음 해"만 만들 수 있으므로 테스트의 올해를 2026으로 고정한다.
 * 쓰는 테스트 클래스에 {@code @Import(TestClock.Config.class)}를 붙인다.
 */
public final class TestClock extends Clock {

    /** 한국 시각 2026-06-15 12:00. */
    public static final Instant DEFAULT = Instant.parse("2026-06-15T03:00:00Z");

    private volatile Instant now = DEFAULT;

    public void set(Instant instant) {
        now = instant;
    }

    public void reset() {
        now = DEFAULT;
    }

    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) { return Clock.fixed(now, zone); }
    @Override public Instant instant() { return now; }

    @TestConfiguration
    public static class Config {
        @Bean
        @Primary
        TestClock testClock() {
            return new TestClock();
        }
    }
}
