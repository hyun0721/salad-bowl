package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시에 들어온 요청이 번호를 겹쳐 쓰지 않는지 실제 트랜잭션으로 확인한다. */
class TaxLawConcurrencyTest extends IntegrationTest {

    private static final int THREADS = 8;

    @Autowired
    UserRepository users;
    @Autowired
    TaxLawService service;
    @Autowired
    TaxLawVersionRepository versions;

    @Test
    void concurrentDraftsGetDistinctConsecutiveNumbers() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(() -> Integer.toString(service.createDraft(adminId, 2026).versionNo()));
        }

        List<String> results = runTogether(calls);

        assertThat(results).containsExactlyInAnyOrder("1", "2", "3", "4", "5", "6", "7", "8");
        assertThat(versions.findByTaxYearOrderByVersionNoDesc(2026)).hasSize(THREADS);
    }

    /** 모든 호출을 같은 순간에 시작한다. 결과는 반환값, ApiException이면 오류 코드 이름이다. */
    static List<String> runTogether(List<Callable<String>> calls) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(calls.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<String>> futures = new ArrayList<>();
            for (Callable<String> call : calls) {
                futures.add(pool.submit(() -> {
                    if (!start.await(30, TimeUnit.SECONDS)) {
                        return "NOT_STARTED";
                    }
                    try {
                        return call.call();
                    } catch (ApiException e) {
                        return e.code().name();
                    } catch (Exception e) {
                        return e.getClass().getName();
                    }
                }));
            }
            start.countDown();
            List<String> results = new ArrayList<>();
            for (Future<String> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
