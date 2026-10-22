package com.saladbowl.api.transaction;

import com.saladbowl.api.importer.ImportService;
import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.ByteArrayInputStream;
import java.time.YearMonth;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LedgerLockTest extends IntegrationTest {

    @Autowired
    LedgerLock ledgerLock;

    @Autowired
    TransactionService transactionService;

    @Autowired
    ImportService importService;

    @Autowired
    UserRepository users;

    @Autowired
    PlatformTransactionManager transactionManager;

    long owner;
    long other;

    private final CountDownLatch locked = new CountDownLatch(1);
    private final CountDownLatch release = new CountDownLatch(1);
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    @BeforeEach
    void setUp() {
        owner = users.save(new User("owner@test.com", "hash", "소유자")).getId();
        other = users.save(new User("other@test.com", "hash", "다른사람")).getId();
    }

    @AfterEach
    void tearDown() throws InterruptedException {
        // 단언이 실패해도 잠금 트랜잭션과 대기 중인 작업이 다음 테스트의 DB 정리와 겹치지 않게 끝낸다.
        release.countDown();
        executor.shutdownNow();
        assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }

    /** 별도 스레드에서 트랜잭션을 열고 ownerId 잠금을 잡은 채 release까지 붙잡아 둔다. */
    private Future<?> holdLock(long ownerId) throws InterruptedException {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        Future<?> holder = executor.submit(() -> template.executeWithoutResult(status -> {
            ledgerLock.lockOwner(ownerId);
            locked.countDown();
            try {
                if (!release.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("lock holder was not released in time");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("lock holder interrupted", e);
            }
        }));
        assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
        return holder;
    }

    private void assertWaitsForLock(Callable<?> work) throws Exception {
        Future<?> holder = holdLock(owner);
        Future<?> waiter = executor.submit(work);

        assertThatThrownBy(() -> waiter.get(500, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);

        release.countDown();
        holder.get(5, TimeUnit.SECONDS);
        waiter.get(5, TimeUnit.SECONDS);
    }

    @Test
    void deleteMonthWaitsForTheOwnersLedgerLock() throws Exception {
        assertWaitsForLock(() -> transactionService.deleteMonth(owner, YearMonth.of(2026, 9), false));
    }

    @Test
    void importWaitsForTheOwnersLedgerLock() throws Exception {
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .toBytes();

        assertWaitsForLock(() -> importService.importFile(owner, "a.xlsx", new ByteArrayInputStream(bytes)));
    }

    @Test
    void otherOwnersAreNotBlocked() throws Exception {
        Future<?> holder = holdLock(owner);

        Future<?> otherDelete = executor.submit(
                () -> transactionService.deleteMonth(other, YearMonth.of(2026, 9), false));

        otherDelete.get(5, TimeUnit.SECONDS);
        release.countDown();
        holder.get(5, TimeUnit.SECONDS);
    }

    @Test
    void lockRequiresATransaction() {
        assertThatThrownBy(() -> ledgerLock.lockOwner(owner))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LedgerLock requires an active transaction");
    }
}
