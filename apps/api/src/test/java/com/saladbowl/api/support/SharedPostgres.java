package com.saladbowl.api.support;

import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;

/**
 * Single Postgres container for the whole test suite. Spring caches application contexts (and their
 * datasource URLs) across test classes, so the container must outlive any single class and must be
 * shared by every base class (MockMvc and real-server alike).
 */
final class SharedPostgres {

    static final PostgreSQLContainer INSTANCE = new PostgreSQLContainer("postgres:16-alpine");

    static {
        INSTANCE.start();
    }

    private SharedPostgres() {
    }

    /** Empties every table in schema public except Flyway's history; picks up future tables automatically. */
    static void truncateAllTables(JdbcTemplate jdbc) {
        List<String> tables = jdbc.queryForList(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'",
                String.class);
        if (tables.isEmpty()) {
            return;
        }
        String names = String.join(", ", tables.stream().map(t -> "public.\"" + t + "\"").toList());
        jdbc.execute("TRUNCATE " + names + " RESTART IDENTITY CASCADE");
    }
}
