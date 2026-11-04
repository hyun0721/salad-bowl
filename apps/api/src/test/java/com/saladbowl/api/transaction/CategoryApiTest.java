package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.support.TestGroups;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CategoryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    private LedgerTransaction manual(AuthedUser owner, String major, String minor) {
        return manual(owner, TransactionType.EXPENSE, major, minor);
    }

    private LedgerTransaction manual(AuthedUser owner, TransactionType type, String major, String minor) {
        return manual(owner, type, major, minor, "2026-10-01T12:00:00");
    }

    private LedgerTransaction manual(AuthedUser owner, TransactionType type, String major, String minor, String occurredAt) {
        return transactions.save(LedgerTransaction.manual(owner.id(), new TransactionData(
                LocalDateTime.parse(occurredAt), type, major, minor, "거래",
                BigDecimal.valueOf(-1000).setScale(2), "KRW", "카드", null)));
    }

    @Test
    void groupsMyDisplayCategoriesByUsage() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, "식비", "카페");
        manual(me, "식비", "카페");
        manual(me, "식비", "점심");
        manual(me, "식비", "");
        manual(me, "교통", "택시");
        manual(me, "교통", "버스");
        LedgerTransaction overridden = manual(me, "기타", "");
        overridden.setCategoryMajorOverride("교통");
        overridden.setCategoryMinorOverride("버스");
        transactions.save(overridden);
        LedgerTransaction hidden = manual(me, "쇼핑", "옷");
        hidden.setHidden(true);
        transactions.save(hidden);

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].type").value("EXPENSE"))
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].count").value(4))
                .andExpect(jsonPath("$[0].minors", hasSize(3)))
                .andExpect(jsonPath("$[0].minors[0].minor").value("카페"))
                .andExpect(jsonPath("$[0].minors[0].count").value(2))
                .andExpect(jsonPath("$[0].minors[1].minor").value(""))
                .andExpect(jsonPath("$[0].minors[2].minor").value("점심"))
                .andExpect(jsonPath("$[1].major").value("교통"))
                .andExpect(jsonPath("$[1].count").value(3))
                .andExpect(jsonPath("$[1].minors[0].minor").value("버스"))
                .andExpect(jsonPath("$[1].minors[0].count").value(2))
                .andExpect(jsonPath("$[1].minors[1].minor").value("택시"))
                .andExpect(jsonPath("$[2].major").value("쇼핑"))
                .andExpect(jsonPath("$[2].count").value(1));
    }

    @Test
    void sortsTiesByName() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, "쇼핑", "");
        manual(me, "교통", "");

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$[0].major").value("교통"))
                .andExpect(jsonPath("$[0].minors[0].minor").value(""))
                .andExpect(jsonPath("$[1].major").value("쇼핑"));
    }

    @Test
    void groupsSameMajorSeparatelyByTypeAndOrdersTypes() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, TransactionType.INCOME, "공통", "급여");
        manual(me, TransactionType.EXPENSE, "공통", "");
        manual(me, TransactionType.TRANSFER, "공통", "이체");
        LedgerTransaction changed = manual(me, TransactionType.EXPENSE, "변경", "");
        changed.setTypeOverride(TransactionType.INCOME);
        transactions.save(changed);

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].type").value("EXPENSE"))
                .andExpect(jsonPath("$[0].major").value("공통"))
                .andExpect(jsonPath("$[0].minors[0].minor").value(""))
                .andExpect(jsonPath("$[1].type").value("INCOME"))
                .andExpect(jsonPath("$[2].type").value("INCOME"))
                .andExpect(jsonPath("$[2].major").value("변경"))
                .andExpect(jsonPath("$[3].type").value("TRANSFER"));
    }

    @Test
    void sortsMinorTiesByNameAndDropsDeletedTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        manual(me, "식비", "카페");
        manual(me, "식비", "간식");
        LedgerTransaction gone = manual(me, "여행", "숙소");

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$", hasSize(2)));

        transactions.delete(gone);

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].minors[0].minor").value("간식"))
                .andExpect(jsonPath("$[0].minors[1].minor").value("카페"));
    }

    @Test
    void showsOnlyMyTransactions() throws Exception {
        AuthedUser me = TestAuth.signupAndLogin(mvc, "me@test.com", "나");
        AuthedUser other = TestAuth.signupAndLogin(mvc, "other@test.com", "남");
        manual(other, "식비", "카페");

        mvc.perform(get("/me/categories").header("Authorization", me.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void groupCategoriesCountOnlySharedVisibleTransactionsAcrossMonths() throws Exception {
        AuthedUser admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        AuthedUser shared = TestAuth.signupAndLogin(mvc, "shared@test.com", "공유");
        AuthedUser privateMember = TestAuth.signupAndLogin(mvc, "private@test.com", "비공개");
        long groupId = TestGroups.createGroup(mvc, admin, "우리집");
        TestGroups.join(mvc, admin, shared, groupId);
        TestGroups.join(mvc, admin, privateMember, groupId);
        manual(admin, "교통", "버스");
        manual(shared, "식비", "점심");
        manual(shared, TransactionType.EXPENSE, "식비", "점심", "2025-01-01T12:00:00");
        LedgerTransaction hidden = manual(shared, "숨김", "비밀");
        hidden.setHidden(true);
        transactions.save(hidden);
        manual(privateMember, "비공개", "비밀");
        mvc.perform(put("/groups/{id}/share", groupId).header("Authorization", privateMember.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk());

        mvc.perform(get("/groups/{id}/categories", groupId).header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].count").value(2))
                .andExpect(jsonPath("$[0].minors[0].minor").value("점심"))
                .andExpect(jsonPath("$[1].major").value("교통"));

        AuthedUser outsider = TestAuth.signupAndLogin(mvc, "outsider@test.com", "외부인");
        mvc.perform(get("/groups/{id}/categories", groupId).header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/me/categories")).andExpect(status().isUnauthorized());
    }
}
