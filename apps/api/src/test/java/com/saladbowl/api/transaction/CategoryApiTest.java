package com.saladbowl.api.transaction;

import com.saladbowl.api.support.IntegrationTest;
import com.saladbowl.api.support.TestAuth;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CategoryApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LedgerTransactionRepository transactions;

    private LedgerTransaction manual(AuthedUser owner, String major, String minor) {
        return transactions.save(LedgerTransaction.manual(owner.id(), new TransactionData(
                LocalDateTime.parse("2026-10-01T12:00:00"), TransactionType.EXPENSE, major, minor, "거래",
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
                .andExpect(jsonPath("$[0].major").value("식비"))
                .andExpect(jsonPath("$[0].count").value(4))
                .andExpect(jsonPath("$[0].minors", hasSize(2)))
                .andExpect(jsonPath("$[0].minors[0].minor").value("카페"))
                .andExpect(jsonPath("$[0].minors[0].count").value(2))
                .andExpect(jsonPath("$[0].minors[1].minor").value("점심"))
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
                .andExpect(jsonPath("$[0].minors", hasSize(0)))
                .andExpect(jsonPath("$[1].major").value("쇼핑"));
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
    void requiresLogin() throws Exception {
        mvc.perform(get("/me/categories")).andExpect(status().isUnauthorized());
    }
}
