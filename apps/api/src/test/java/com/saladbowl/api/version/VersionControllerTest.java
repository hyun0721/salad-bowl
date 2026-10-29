package com.saladbowl.api.version;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import static org.assertj.core.api.Assertions.*;

class VersionControllerTest {
    @Test
    void readsThePackagedProductionVersion() throws Exception {
        String sha = "a".repeat(40);
        var controller = new VersionController(new ByteArrayResource(
                ("version=0.1.42\ncommit=" + sha + "\n").getBytes(StandardCharsets.UTF_8)));
        assertThat(controller.version().getBody())
                .isEqualTo(new VersionController.BuildVersion("0.1.42", sha));
    }

    @Test
    void refusesIncompleteMetadata() {
        assertThatThrownBy(() -> new VersionController(new ByteArrayResource("version=0.1.2\n".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(IllegalStateException.class);
    }
}
