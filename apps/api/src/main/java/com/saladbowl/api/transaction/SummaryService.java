package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTotal;
import com.saladbowl.api.transaction.SummaryDtos.MemberTotal;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 그룹 월간 요약: KRW만, 이체·숨긴 거래 제외, 지출은 양수 합계(환불은 차감). */
@Service
public class SummaryService {

    static final String SUMMARY_CURRENCY = "KRW";
    static final String UNCATEGORIZED = "미분류";

    private final LedgerTransactionRepository transactions;
    private final GroupAccess access;
    private final UserRepository users;
    private final TransactionViews views;

    public SummaryService(LedgerTransactionRepository transactions, GroupAccess access, UserRepository users,
                          TransactionViews views) {
        this.transactions = transactions;
        this.access = access;
        this.users = users;
        this.views = views;
    }

    /** 요약에 들어가는 그룹 거래. 합계와 거래 목록이 어긋나지 않도록 한 곳에서만 고른다. */
    private List<LedgerTransaction> summaryTransactions(List<Long> owners, YearMonth month) {
        if (owners.isEmpty()) {
            return List.of();
        }
        TransactionService.Range range = TransactionService.monthRange(month);
        return transactions.findVisibleBetween(owners, range.from(), range.to()).stream()
                .filter(tx -> SUMMARY_CURRENCY.equals(tx.getCurrency()))
                .filter(tx -> tx.getType() != TransactionType.TRANSFER)
                .toList();
    }

    /** 대분류가 비었으면 한 묶음으로 보이도록 "미분류"로 센다. 공백 제거는 하지 않는다(기존 집계 키 유지). */
    static String majorLabel(LedgerTransaction tx) {
        String major = tx.displayCategory().major();
        return major == null || major.isBlank() ? UNCATEGORIZED : major;
    }

    @Transactional(readOnly = true)
    public MonthlySummary monthly(long groupId, long userId, YearMonth month) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        List<LedgerTransaction> txs = summaryTransactions(owners, month);

        BigDecimal income = sum(txs, TransactionType.INCOME);
        BigDecimal expense = sum(txs, TransactionType.EXPENSE).negate();

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (LedgerTransaction tx : txs) {
            if (tx.getType() == TransactionType.EXPENSE) {
                byCategory.merge(majorLabel(tx), tx.getAmount().negate(), BigDecimal::add);
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

    /** 요약의 대분류 조각 하나를 이루는 거래. 환불(양수 지출)도 넣어야 합계가 조각과 같다. */
    @Transactional(readOnly = true)
    public List<TransactionView> categoryTransactions(long groupId, long userId, YearMonth month, String category) {
        access.requireMember(groupId, userId);
        List<LedgerTransaction> matched = summaryTransactions(access.sharedOwnerIds(groupId), month).stream()
                .filter(tx -> tx.getType() == TransactionType.EXPENSE)
                .filter(tx -> majorLabel(tx).equals(category))
                .toList();
        Map<Long, Boolean> editable = new HashMap<>();
        return views.toViews(matched,
                owner -> editable.computeIfAbsent(owner, id -> access.canEditOwnedBy(userId, id)));
    }

    private static BigDecimal sum(List<LedgerTransaction> txs, TransactionType type) {
        return txs.stream()
                .filter(tx -> tx.getType() == type)
                .map(LedgerTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
