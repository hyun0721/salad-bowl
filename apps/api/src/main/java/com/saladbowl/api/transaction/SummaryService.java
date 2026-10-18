package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTotal;
import com.saladbowl.api.transaction.SummaryDtos.MemberTotal;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 그룹 월간 요약: KRW만, 이체·숨긴 거래 제외, 지출은 양수 합계(환불은 차감). */
@Service
public class SummaryService {

    static final String SUMMARY_CURRENCY = "KRW";

    private final LedgerTransactionRepository transactions;
    private final GroupAccess access;
    private final UserRepository users;

    public SummaryService(LedgerTransactionRepository transactions, GroupAccess access, UserRepository users) {
        this.transactions = transactions;
        this.access = access;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public MonthlySummary monthly(long groupId, long userId, YearMonth month) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        TransactionService.Range range = TransactionService.monthRange(month);
        List<LedgerTransaction> txs = owners.isEmpty()
                ? List.of()
                : transactions.findVisibleBetween(owners, range.from(), range.to()).stream()
                        .filter(tx -> SUMMARY_CURRENCY.equals(tx.getCurrency()))
                        .filter(tx -> tx.getType() != TransactionType.TRANSFER)
                        .toList();

        BigDecimal income = sum(txs, TransactionType.INCOME);
        BigDecimal expense = sum(txs, TransactionType.EXPENSE).negate();

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (LedgerTransaction tx : txs) {
            if (tx.getType() == TransactionType.EXPENSE) {
                byCategory.merge(tx.displayCategory().major(), tx.getAmount().negate(), BigDecimal::add);
            }
        }
        List<CategoryTotal> categories = byCategory.entrySet().stream()
                .map(e -> new CategoryTotal(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(CategoryTotal::expense).reversed()
                        .thenComparing(CategoryTotal::category))
                .toList();

        Map<Long, String> nicknames = users.findAllById(owners).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        List<MemberTotal> members = owners.stream()
                .map(ownerId -> {
                    List<LedgerTransaction> own = txs.stream().filter(t -> t.getOwnerId().equals(ownerId)).toList();
                    return new MemberTotal(ownerId, nicknames.get(ownerId),
                            sum(own, TransactionType.INCOME), sum(own, TransactionType.EXPENSE).negate());
                })
                .toList();

        return new MonthlySummary(month.toString(), income, expense, categories, members);
    }

    private static BigDecimal sum(List<LedgerTransaction> txs, TransactionType type) {
        return txs.stream()
                .filter(tx -> tx.getType() == type)
                .map(LedgerTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
