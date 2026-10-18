package com.saladbowl.api.common;

import com.saladbowl.api.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(ExceptionMappingTest.ThrowingController.class)
class ExceptionMappingTest extends IntegrationTest {

    @RestController
    static class ThrowingController {

        @GetMapping("/test-errors/required-param")
        String requiredParam(@RequestParam String q) {
            return q;
        }

        @GetMapping("/test-errors/status-conflict")
        String statusConflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "already done");
        }

        @GetMapping("/test-errors/denied")
        String denied() {
            throw new AccessDeniedException("no");
        }

        @GetMapping("/test-errors/integrity")
        String integrity() {
            throw new DataIntegrityViolationException("duplicate key");
        }

        @GetMapping("/test-errors/too-many")
        String tooMany() {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "slow down");
        }

        @GetMapping("/test-errors/boom")
        String boom() {
            throw new IllegalStateException("secret internal detail");
        }
    }

    @Autowired
    MockMvc mvc;

    @Test
    void missingRequestParamKeeps400() throws Exception {
        mvc.perform(get("/test-errors/required-param").with(user("tester")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void responseStatusExceptionKeepsItsStatus() throws Exception {
        mvc.perform(get("/test-errors/status-conflict").with(user("tester")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void accessDeniedReturns403() throws Exception {
        mvc.perform(get("/test-errors/denied").with(user("tester")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void dataIntegrityViolationReturns409() throws Exception {
        mvc.perform(get("/test-errors/integrity").with(user("tester")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void unmappedFourXxKeepsStatusWithRequestFailedCode() throws Exception {
        mvc.perform(get("/test-errors/too-many").with(user("tester")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("REQUEST_FAILED"));
    }

    @Test
    void unexpectedExceptionReturns500WithoutDetails() throws Exception {
        mvc.perform(get("/test-errors/boom").with(user("tester")))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("internal server error"));
    }
}
