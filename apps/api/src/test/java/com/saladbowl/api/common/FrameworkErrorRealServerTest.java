package com.saladbowl.api.common;

import com.jayway.jsonpath.JsonPath;
import com.saladbowl.api.support.RealServerIntegrationTest;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs against a real embedded server: MockMvc never performs the container ERROR dispatch, so only
 * a real server shows whether framework errors (sendError -> /error) are rewritten to 401 by security.
 */
class FrameworkErrorRealServerTest extends RealServerIntegrationTest {

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> send(String method, String path, String contentType, String body, String token)
            throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url(path)))
                .method(method, body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body));
        if (contentType != null) {
            b.header("Content-Type", contentType);
        }
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String accessToken() throws Exception {
        String creds = """
                {"email":"real@test.com","password":"password123","nickname":"real"}
                """;
        send("POST", "/auth/signup", "application/json", creds, null);
        HttpResponse<String> login = send("POST", "/auth/login", "application/json", creds, null);
        assertThat(login.statusCode()).isEqualTo(200);
        return JsonPath.read(login.body(), "$.accessToken");
    }

    private void assertError(HttpResponse<String> res, int status, String code) {
        assertThat(res.statusCode()).isEqualTo(status);
        assertThat(res.headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
        assertThat((String) JsonPath.read(res.body(), "$.code")).isEqualTo(code);
        assertThat((String) JsonPath.read(res.body(), "$.message")).isNotBlank();
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        assertError(send("POST", "/auth/signup", "application/json", "{not json", null),
                400, "VALIDATION_FAILED");
    }

    @Test
    void unsupportedMediaTypeReturns415() throws Exception {
        assertError(send("POST", "/auth/signup", "text/plain", "hello", null),
                415, "UNSUPPORTED_MEDIA_TYPE");
    }

    @Test
    void unsupportedMethodReturns405() throws Exception {
        assertError(send("DELETE", "/me", null, null, accessToken()),
                405, "METHOD_NOT_ALLOWED");
    }

    @Test
    void unknownPathReturns404() throws Exception {
        assertError(send("GET", "/does-not-exist", null, null, accessToken()),
                404, "NOT_FOUND");
    }

    @Test
    void missingTokenStillReturns401() throws Exception {
        assertError(send("GET", "/me", null, null, null), 401, "UNAUTHORIZED");
    }
}
