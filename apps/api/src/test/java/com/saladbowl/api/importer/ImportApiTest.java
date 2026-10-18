package com.saladbowl.api.importer;

import com.saladbowl.api.support.BanksaladWorkbook;
import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.servlet.autoconfigure.MultipartProperties;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.unit.DataSize;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ImportApiTest extends IntegrationTest {

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    @Autowired
    MultipartProperties multipartProperties;

    @Autowired
    ImportBatchRepository batches;

    AuthedUser owner;

    @BeforeEach
    void setUp() throws Exception {
        owner = TestAuth.signupAndLogin(mvc, "owner@test.com", "소유자");
    }

    private static MockMultipartFile ledger(String fileName) {
        byte[] bytes = BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "현금", null)
                .row("2026-09-02", "19:00:00", "지출", "식비", "저녁", "국밥", -9000, "신한카드", null)
                .toBytes();
        return new MockMultipartFile("file", fileName, XLSX, bytes);
    }

    @Test
    void uploadCreatesTransactions() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("2026-09.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.batchId").isNumber())
                .andExpect(jsonPath("$.totalRows").value(2))
                .andExpect(jsonPath("$.createdRows").value(2))
                .andExpect(jsonPath("$.unchangedRows").value(0));

        assertThat(transactions.countByOwnerId(owner.id())).isEqualTo(2);
    }

    @Test
    void reuploadReportsUnchangedRows() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("a.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        mvc.perform(multipart("/imports").file(ledger("a.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdRows").value(0))
                .andExpect(jsonPath("$.unchangedRows").value(2));
    }

    @Test
    void nonXlsxFileNameIsRejected() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("ledger.csv")).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void garbageContentIsRejected() throws Exception {
        MockMultipartFile garbage = new MockMultipartFile("file", "fake.xlsx", XLSX,
                "not excel".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart("/imports").file(garbage).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void emptyFileIsRejected() throws Exception {
        MockMultipartFile empty = new MockMultipartFile("file", "empty.xlsx", XLSX, new byte[0]);

        mvc.perform(multipart("/imports").file(empty).header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_FORMAT"));
    }

    @Test
    void missingFilePartReturns400() throws Exception {
        mvc.perform(multipart("/imports").header("Authorization", owner.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void uploadRequiresLogin() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("a.xlsx")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historyListsMyBatchesNewestFirst() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("first.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());
        mvc.perform(multipart("/imports").file(ledger("second.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        mvc.perform(get("/imports").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].fileName").value("second.xlsx"))
                .andExpect(jsonPath("$[1].fileName").value("first.xlsx"))
                .andExpect(jsonPath("$[0].importedAt").isString());
    }

    @Test
    void uploadLimitIsFiveMegabytes() {
        assertThat(multipartProperties.getMaxFileSize()).isEqualTo(DataSize.ofMegabytes(5));
    }

    @Test
    void storedFileNameKeepsOnlyTheLastPathSegment() throws Exception {
        mvc.perform(multipart("/imports").file(ledger("C:\\Users\\me\\2026-09.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());
        mvc.perform(multipart("/imports").file(ledger("../../etc/2026-08.xlsx")).header("Authorization", owner.bearer()))
                .andExpect(status().isCreated());

        assertThat(batches.findAll()).extracting(ImportBatch::getFileName)
                .containsExactlyInAnyOrder("2026-09.xlsx", "2026-08.xlsx");
    }
}
