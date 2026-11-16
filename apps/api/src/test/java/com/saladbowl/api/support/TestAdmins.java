package com.saladbowl.api.support;

import org.springframework.jdbc.core.JdbcTemplate;

/** 통합 테스트용: 운영 절차(docs/deploy.md)와 같은 방식으로 DB에서 서비스 관리자를 지정·회수한다. */
public final class TestAdmins {

    private TestAdmins() {
    }

    public static void grant(JdbcTemplate jdbc, long userId) {
        jdbc.update("UPDATE users SET service_admin = TRUE WHERE id = ?", userId);
    }

    public static void revoke(JdbcTemplate jdbc, long userId) {
        jdbc.update("UPDATE users SET service_admin = FALSE WHERE id = ?", userId);
    }
}
