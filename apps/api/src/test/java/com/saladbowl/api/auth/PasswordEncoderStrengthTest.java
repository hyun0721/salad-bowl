package com.saladbowl.api.auth;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderStrengthTest extends IntegrationTest {

    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void testsUseLowBcryptCost() {
        assertThat(passwordEncoder.encode("password123")).startsWith("$2a$04$");
    }
}
