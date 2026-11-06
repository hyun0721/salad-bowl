package com.saladbowl.api.transaction;

import com.saladbowl.api.support.*;
import com.saladbowl.api.support.TestAuth.AuthedUser;
import com.saladbowl.api.group.GroupMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TagListApiTest extends IntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired LedgerTransactionRepository transactions;
    @Autowired GroupMemberRepository members;

    private void add(AuthedUser user, String memo, String override, boolean hidden) {
        var tx = LedgerTransaction.manual(user.id(), new TransactionData(LocalDateTime.parse("2025-01-01T12:00:00"),
                TransactionType.EXPENSE, "식비", "", "가짜 거래", BigDecimal.ONE, "KRW", "카드", memo));
        tx.setMemoOverride(override);
        tx.setHidden(hidden);
        transactions.save(tx);
    }

    @Test
    void mineIncludesHiddenAndCountsEachDisplayTagOnce() throws Exception {
        var user = TestAuth.signupAndLogin(mvc, "tags@test.com", "태그");
        var other = TestAuth.signupAndLogin(mvc, "other@test.com", "다른이");
        add(user, "#B #B #A", null, false);
        add(user, "#original", "#B #C", true);
        add(user, "#erased", "", false);
        add(user, "ordinary", null, false);
        add(other, "#outsider", null, false);
        mvc.perform(get("/me/tags").header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].tag").value("B")).andExpect(jsonPath("$[0].count").value(2))
                .andExpect(jsonPath("$[1].tag").value("A")).andExpect(jsonPath("$[1].count").value(1))
                .andExpect(jsonPath("$[2].tag").value("C"));
    }

    @Test
    void groupRespectsSharingHiddenAndMembership() throws Exception {
        var admin = TestAuth.signupAndLogin(mvc, "admin@test.com", "관리자");
        var shared = TestAuth.signupAndLogin(mvc, "shared@test.com", "공유");
        var privateUser = TestAuth.signupAndLogin(mvc, "private@test.com", "비공개");
        var outsider = TestAuth.signupAndLogin(mvc, "outsider@test.com", "외부");
        long group = TestGroups.createGroup(mvc, admin, "태그 그룹");
        TestGroups.join(mvc, admin, shared, group);
        TestGroups.join(mvc, admin, privateUser, group);
        var membership = members.findByGroupIdAndUserId(group, privateUser.id()).orElseThrow();
        membership.setShareEnabled(false);
        members.save(membership);
        add(admin, "#A", null, false);
        add(shared, "#A #B #B", null, false);
        add(shared, "#hidden", null, true);
        add(privateUser, "#private", null, false);
        mvc.perform(get("/groups/{id}/tags", group).header("Authorization", shared.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].tag").value("A")).andExpect(jsonPath("$[0].count").value(2))
                .andExpect(jsonPath("$[1].tag").value("B")).andExpect(jsonPath("$[1].count").value(1));
        mvc.perform(get("/groups/{id}/tags", group).header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/groups/{id}/tags", 999999999).header("Authorization", outsider.bearer()))
                .andExpect(status().isNotFound());
        for (var user : java.util.List.of(admin, shared)) {
            var m = members.findByGroupIdAndUserId(group, user.id()).orElseThrow();
            m.setShareEnabled(false);
            members.save(m);
        }
        mvc.perform(get("/groups/{id}/tags", group).header("Authorization", admin.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void limitsTo200AfterSorting() throws Exception {
        var user = TestAuth.signupAndLogin(mvc, "many@test.com", "많은태그");
        for (int i = 200; i >= 0; i--) add(user, "#tag%03d".formatted(i), null, false);
        mvc.perform(get("/me/tags").header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(200))
                .andExpect(jsonPath("$[0].tag").value("tag000"))
                .andExpect(jsonPath("$[199].tag").value("tag199"));
    }
}
