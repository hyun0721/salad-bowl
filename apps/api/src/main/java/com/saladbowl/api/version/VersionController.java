package com.saladbowl.api.version;

import java.io.IOException;
import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VersionController {
    public record BuildVersion(String version, String commit) {}

    private final BuildVersion metadata;

    public VersionController(@Value("classpath:version.properties") Resource resource) throws IOException {
        Properties values = new Properties();
        try (var input = resource.getInputStream()) {
            values.load(input);
        }
        String version = values.getProperty("version", "");
        String commit = values.getProperty("commit", "");
        if (!version.matches("dev|0\\.1\\.[0-9]+(-preview\\.[0-9a-f]{7})?")
                || !commit.matches("unknown|[0-9a-f]{40}")) {
            throw new IllegalStateException("Invalid build metadata");
        }
        metadata = new BuildVersion(version, commit);
    }

    @GetMapping("/version")
    public ResponseEntity<BuildVersion> version() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(metadata);
    }
}
