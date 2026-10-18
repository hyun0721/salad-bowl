package com.saladbowl.api.transaction;

import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private final LedgerTransactionRepository transactions;
    private final TransactionViews views;
    private final GroupAccess access;

    public TransactionService(LedgerTransactionRepository transactions, TransactionViews views, GroupAccess access) {
        this.transactions = transactions;
        this.views = views;
        this.access = access;
    }

    public record Range(LocalDateTime from, LocalDateTime to) {
    }

    public static Range monthRange(YearMonth month) {
        return new Range(month.atDay(1).atStartOfDay(), month.plusMonths(1).atDay(1).atStartOfDay());
    }

    @Transactional(readOnly = true)
    public List<TransactionView> myTransactions(long userId, YearMonth month) {
        Range range = monthRange(month);
        return views.toViews(transactions.findOwnedBetween(userId, range.from(), range.to()), owner -> true);
    }

    @Transactional(readOnly = true)
    public List<TransactionView> groupTransactions(long groupId, long userId, YearMonth month, Long memberId) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        if (memberId != null) {
            owners = owners.contains(memberId) ? List.of(memberId) : List.of();
        }
        if (owners.isEmpty()) {
            return List.of();
        }
        Range range = monthRange(month);
        Map<Long, Boolean> editable = new HashMap<>();
        return views.toViews(transactions.findVisibleBetween(owners, range.from(), range.to()),
                owner -> editable.computeIfAbsent(owner, id -> access.canEditOwnedBy(userId, id)));
    }

    @Transactional
    public TransactionView addManual(long userId, ManualTransactionRequest request) {
        TransactionData data = new TransactionData(
                request.occurredAt(),
                request.type(),
                request.categoryMajor().strip(),
                request.categoryMinor() == null ? "" : request.categoryMinor().strip(),
                request.description().strip(),
                request.amount().setScale(2, RoundingMode.HALF_UP),
                "KRW",
                request.paymentMethod() == null ? "" : request.paymentMethod().strip(),
                request.memo() == null || request.memo().isBlank() ? null : request.memo().strip());
        LedgerTransaction tx = transactions.save(LedgerTransaction.manual(userId, data));
        return views.toView(tx, true);
    }
}
