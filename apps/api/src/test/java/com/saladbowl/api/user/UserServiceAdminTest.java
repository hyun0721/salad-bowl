package com.saladbowl.api.user;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class UserServiceAdminTest extends IntegrationTest {

    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void signupDefaultsToNonAdmin() throws Exception {
        long id = TestAuth.signupAndLogin(mvc, "member@example.test", "회원").id();
        assertThat(jdbc.queryForObject("SELECT service_admin FROM users WHERE id = ?", Boolean.class, id))
                .isFalse();
    }

    @Test
    void savingGoogleLinkDoesNotRestoreRevokedAdmin() {
        long id = users.save(new User("member@example.test", "hash", "회원")).getId();
        jdbc.update("UPDATE users SET service_admin = TRUE WHERE id = ?", id);

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            User user = users.findById(id).orElseThrow();
            assertThat(user.isServiceAdmin()).isTrue();
            jdbc.update("UPDATE users SET service_admin = FALSE WHERE id = ?", id);
            user.linkGoogle("synthetic-google-sub");
            users.saveAndFlush(user);
        });

        assertThat(jdbc.queryForObject("SELECT google_sub FROM users WHERE id = ?", String.class, id))
                .isEqualTo("synthetic-google-sub");
        assertThat(jdbc.queryForObject("SELECT service_admin FROM users WHERE id = ?", Boolean.class, id))
                .isFalse();
    }
}
