package com.saladbowl.api.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Base for tests that need a real embedded servlet container (e.g. to exercise the ERROR dispatch,
 * which MockMvc does not perform). Shares the one Postgres container with {@link IntegrationTest}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class RealServerIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer postgres = SharedPostgres.INSTANCE;

    @LocalServerPort
    protected int port;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        SharedPostgres.truncateAllTables(jdbcTemplate);
    }

    protected String url(String path) {
        return "http://localhost:" + port + path;
    }
}
