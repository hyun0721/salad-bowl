package com.saladbowl.api.tax.law;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시에 들어온 요청이 번호를 겹쳐 쓰거나 한 버전을 두 번 바꾸지 않는지 실제 트랜잭션으로 확인한다. */
class TaxLawConcurrencyTest extends IntegrationTest {

    private static final int THREADS = 8;
    private static final int ROUNDS = 10;

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

    @Test
    void concurrentAppliesOfOneDraftSucceedOnce() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        long id = filledDraft(adminId);
        List<Callable<String>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(() -> {
                service.apply(adminId, id);
                return "OK";
            });
        }

        List<String> results = runTogether(calls);

        assertThat(results).filteredOn("OK"::equals).hasSize(1);
        assertThat(results).filteredOn("CONFLICT"::equals).hasSize(THREADS - 1);
        assertThat(versions.findById(id).orElseThrow().getStatus()).isEqualTo(TaxLawStatus.APPLIED);
    }

    @Test
    void applyRacingDeleteNeverLosesAnAppliedVersion() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        for (int round = 0; round < ROUNDS; round++) {
            long id = filledDraft(adminId);

            List<String> results = runTogether(List.of(
                    () -> {
                        service.apply(adminId, id);
                        return "APPLIED";
                    },
                    () -> {
                        service.deleteDraft(id);
                        return "DELETED";
                    }));

            // 둘 중 하나만 이긴다. 적용이 이기면 삭제는 409이고 행이 남는다. 삭제가 이기면 적용은 404다.
            if (results.contains("APPLIED")) {
                assertThat(results).as("round %d", round).containsExactly("APPLIED", "CONFLICT");
                assertThat(versions.findById(id).orElseThrow().getStatus()).isEqualTo(TaxLawStatus.APPLIED);
            } else {
                assertThat(results).as("round %d", round).containsExactly("NOT_FOUND", "DELETED");
                assertThat(versions.findById(id)).isEmpty();
            }
        }
    }

    @Test
    void applyRacingUpdateNeverAppliesAnInvalidValue() throws Exception {
        long adminId = users.save(new User("admin@test.com", "hash", "관리자")).getId();
        for (int round = 0; round < ROUNDS; round++) {
            long id = filledDraft(adminId);
            UpdateRequest invalid = new UpdateRequest(1L, 101, 70_000_000L, 15, 30, 30, 40, 40,
                    List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                    3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2",
                    "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), null);

            List<String> results = runTogether(List.of(
                    () -> {
                        service.apply(adminId, id);
                        return "APPLIED";
                    },
                    () -> {
                        service.updateDraft(id, invalid);
                        return "UPDATED";
                    }));

            TaxLawVersion version = versions.findById(id).orElseThrow();
            if (results.contains("APPLIED")) {
                assertThat(results).as("round %d", round).containsExactly("APPLIED", "CONFLICT");
                assertThat(version.getStatus()).isEqualTo(TaxLawStatus.APPLIED);
                assertThat(version.getMinSpendRatePct()).isEqualTo(25);
            } else {
                assertThat(results).as("round %d", round).containsExactly("VALIDATION_FAILED", "UPDATED");
                assertThat(version.getStatus()).isEqualTo(TaxLawStatus.DRAFT);
                assertThat(version.getMinSpendRatePct()).isEqualTo(101);
            }
        }
    }

    private long filledDraft(long adminId) {
        long id = service.createDraft(adminId, 2026).id();
        service.updateDraft(id, new UpdateRequest(0L, 25, 70_000_000L, 15, 30, 30, 40, 40,
                List.of(3_000_000L, 3_500_000L, 4_000_000L), List.of(2_500_000L, 2_750_000L, 3_000_000L),
                3_000_000L, 2_000_000L, "조세특례제한법", "제126조의2",
                "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=284389",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), null));
        return id;
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
