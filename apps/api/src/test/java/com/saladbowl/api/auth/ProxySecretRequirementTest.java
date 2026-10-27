package com.saladbowl.api.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProxySecretRequirementTest {

    @Test
    void prodRejectsBlankOrShortSecret() {
        assertThatThrownBy(() -> SecurityConfig.requireProxySecret(true, "")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SecurityConfig.requireProxySecret(true, "   ")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SecurityConfig.requireProxySecret(true, "short")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodAcceptsLongSecretAndOtherProfilesAllowBlank() {
        assertThatCode(() -> SecurityConfig.requireProxySecret(true, "x".repeat(32))).doesNotThrowAnyException();
        assertThatCode(() -> SecurityConfig.requireProxySecret(false, "")).doesNotThrowAnyException();
    }
}
