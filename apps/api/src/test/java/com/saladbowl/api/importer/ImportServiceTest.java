package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.transaction.Category;
import com.saladbowl.api.transaction.LedgerTransaction;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportServiceTest extends IntegrationTest {

    @Autowired
    ImportService importService;

    @Autowired
    UserRepository users;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    ImportBatchRepository batches;

    @Autowired
    MergeService mergeService;

    @Autowired
    PlatformTransactionManager transactionManager;

    long ownerId;

    @BeforeEach
    void setUp() {
        ownerId = users.save(new User("owner@test.com", "hash", "소유자")).getId();
    }

    private static BanksaladWorkbook september() {
        return BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-02", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "신한카드", "회식")
                .row("2026-09-25", "09:00:00", "수입", "급여", "월급", "회사", 3000000, "국민은행", null);
    }

    private ImportResult importBytes(long owner, byte[] bytes) {
        return importService.importFile(owner, "september.xlsx", new ByteArrayInputStream(bytes));
    }

    @Test
    void firstImportCreatesEveryRowAndRecordsBatch() {
        ImportResult result = importBytes(ownerId, september().toBytes());

        assertThat(result.totalRows()).isEqualTo(3);
        assertThat(result.createdRows()).isEqualTo(3);
        assertThat(result.updatedRows()).isZero();
        assertThat(result.unchangedRows()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
        ImportBatch batch = batches.findById(result.batchId()).orElseThrow();
        assertThat(batch.getFileName()).isEqualTo("september.xlsx");
        assertThat(batch.getCreatedRows()).isEqualTo(3);
    }

    @Test
    void reimportingTheSameFileChangesNothing() {
        importBytes(ownerId, september().toBytes());

        ImportResult again = importBytes(ownerId, september().toBytes());

        assertThat(again.createdRows()).isZero();
        assertThat(again.unchangedRows()).isEqualTo(3);
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
    }

    @Test
    void reimportUpdatesOriginalCategoryButKeepsUserOverride() {
        importBytes(ownerId, september().toBytes());
        LedgerTransaction kimbap = findByDescription("김밥");
        kimbap.setMemoOverride("내가 쓴 메모");
        transactions.save(kimbap);

        ImportResult again = importBytes(ownerId, BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "외식", "분식", "김밥", -4000, "현금", "앱 메모")
                .toBytes());

        assertThat(again.updatedRows()).isEqualTo(1);
        LedgerTransaction reloaded = findByDescription("김밥");
        assertThat(reloaded.displayCategory()).isEqualTo(new Category("외식", "분식"));
        assertThat(reloaded.displayMemo()).isEqualTo("내가 쓴 메모");
    }

    @Test
    void hiddenFlagSurvivesReimport() {
        importBytes(ownerId, september().toBytes());
        LedgerTransaction kimbap = findByDescription("김밥");
        kimbap.setHidden(true);
        transactions.save(kimbap);

        ImportResult again = importBytes(ownerId, BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "외식", "분식", "김밥", -4000, "현금", null)
                .toBytes());

        assertThat(again.updatedRows()).isEqualTo(1);
        LedgerTransaction reloaded = findByDescription("김밥");
        assertThat(reloaded.displayCategory()).isEqualTo(new Category("외식", "분식"));
        assertThat(reloaded.isHidden()).isTrue();
    }

    @Test
    void rowsMissingFromTheNewFileAreKept() {
        importBytes(ownerId, september().toBytes());

        importBytes(ownerId, BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .toBytes());

        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(3);
    }

    @Test
    void identicalRowsInOneFileAreBothKeptAndNotDuplicatedOnReimport() {
        BanksaladWorkbook twice = BanksaladWorkbook.create()
                .row("2026-09-03", "08:30:00", "지출", "교통", "버스", "버스", -1500, "티머니", null)
                .row("2026-09-03", "08:30:00", "지출", "교통", "버스", "버스", -1500, "티머니", null);

        assertThat(importBytes(ownerId, twice.toBytes()).createdRows()).isEqualTo(2);
        assertThat(importBytes(ownerId, twice.toBytes()).createdRows()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isEqualTo(2);
    }

    @Test
    void sameFileForAnotherOwnerIsIndependent() {
        long otherId = users.save(new User("other@test.com", "hash", "다른사람")).getId();
        importBytes(ownerId, september().toBytes());

        ImportResult other = importBytes(otherId, september().toBytes());

        assertThat(other.createdRows()).isEqualTo(3);
    }

    @Test
    void invalidFileWritesNothing() {
        assertThatThrownBy(() -> importBytes(ownerId, "garbage".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ApiException.class);

        assertThat(batches.count()).isZero();
        assertThat(transactions.countByOwnerId(ownerId)).isZero();
    }

    @Test
    void acceptsAFileSpanningAtMost92Days() {
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-07-01", "09:00:00", "지출", "식비", "카페", "첫날", -1000, "테스트카드", null)
                .row("2026-10-01", "21:00:00", "지출", "식비", "카페", "마지막날", -1000, "테스트카드", null)
                .toBytes();

        ImportResult result = importService.importFile(ownerId, "q3.xlsx", new ByteArrayInputStream(bytes));

        assertThat(result.totalRows()).isEqualTo(2);
    }

    @Test
    void rejectsAFileSpanningMoreThan92DaysAndWritesNothing() {
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-07-01", "09:00:00", "지출", "식비", "카페", "첫날", -1000, "테스트카드", null)
                .row("2026-10-02", "09:00:00", "지출", "식비", "카페", "93일째", -1000, "테스트카드", null)
                .toBytes();

        assertThatThrownBy(() -> importService.importFile(ownerId, "too-long.xlsx", new ByteArrayInputStream(bytes)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo(ErrorCode.IMPORT_PERIOD_TOO_LONG))
                .hasMessageContaining("2026-07-01")
                .hasMessageContaining("2026-10-02");
        assertThat(importService.recent(ownerId)).isEmpty();
    }

    @Test
    void parsesAndChecksThePeriodBeforeOpeningATransaction() {
        AtomicBoolean transactionDuringParse = new AtomicBoolean(true);
        BanksaladParser probe = new BanksaladParser() {
            @Override
            public List<ParsedRow> parse(InputStream in) {
                transactionDuringParse.set(TransactionSynchronizationManager.isActualTransactionActive());
                return super.parse(in);
            }
        };
        ImportService service = new ImportService(probe, mergeService, batches, transactionManager);
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-09-01", "09:00:00", "지출", "식비", "카페", "테스트카페", -4500, "테스트카드", null)
                .toBytes();

        service.importFile(ownerId, "probe.xlsx", new ByteArrayInputStream(bytes));

        assertThat(transactionDuringParse).isFalse();
    }

    /** 위 테스트는 서비스를 직접 만들어 프록시를 거치지 않는다. 메서드에 @Transactional이 다시 붙으면 여기서 잡는다. */
    @Test
    void importFileIsNotWrappedInADeclarativeTransaction() throws Exception {
        Method method = ImportService.class.getMethod("importFile", long.class, String.class, InputStream.class);

        assertThat(method.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(ImportService.class.isAnnotationPresent(Transactional.class)).isFalse();
    }

    private LedgerTransaction findByDescription(String description) {
        List<LedgerTransaction> all = transactions.findAll();
        return all.stream().filter(t -> t.getDescription().equals(description)).findFirst().orElseThrow();
    }
}
