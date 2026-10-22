package com.saladbowl.api.transaction;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.TransactionDtos.AuditView;
import com.saladbowl.api.transaction.TransactionDtos.CoverageMonth;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.MonthDeleteResult;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.transaction.TransactionDtos.UpdateTransactionRequest;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    private final LedgerTransactionRepository transactions;
    private final TransactionViews views;
    private final GroupAccess access;
    private final TransactionAuditRepository audits;
    private final UserRepository users;
    private final LedgerLock ledgerLock;

    public TransactionService(LedgerTransactionRepository transactions, TransactionViews views, GroupAccess access,
                              TransactionAuditRepository audits, UserRepository users, LedgerLock ledgerLock) {
        this.transactions = transactions;
        this.views = views;
        this.access = access;
        this.audits = audits;
        this.users = users;
        this.ledgerLock = ledgerLock;
    }

    public record Range(LocalDateTime from, LocalDateTime to) {
    }

    public static Range monthRange(YearMonth month) {
        if (month.getYear() < 1 || month.getYear() > 9999) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "month must be between 0001-01 and 9999-12");
        }
        return new Range(month.atDay(1).atStartOfDay(), month.plusMonths(1).atDay(1).atStartOfDay());
    }

    @Transactional(readOnly = true)
    public List<TransactionView> myTransactions(long userId, YearMonth month) {
        Range range = monthRange(month);
        return views.toViews(transactions.findOwnedBetween(userId, range.from(), range.to()), owner -> true);
    }

    @Transactional(readOnly = true)
    public List<CoverageMonth> coverage(long userId, int year) {
        if (year < 1 || year > 9999) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "year must be between 1 and 9999");
        }
        LocalDateTime from = LocalDateTime.of(year, 1, 1, 0, 0);
        LocalDateTime to = from.plusYears(1);
        return transactions.countByMonth(userId, from, to).stream()
                .map(row -> new CoverageMonth(
                        YearMonth.of(year, ((Number) row[0]).intValue()).toString(),
                        ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue()))
                .toList();
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

    @Transactional
    public TransactionView update(long actorId, long transactionId, UpdateTransactionRequest request) {
        LedgerTransaction tx = findVisible(actorId, transactionId);
        boolean owner = tx.getOwnerId() == actorId;
        if (!owner && !access.canEditOwnedBy(actorId, tx.getOwnerId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "cannot edit this transaction");
        }
        if (!owner && request.hidden() != null) {
            throw new ApiException(ErrorCode.FORBIDDEN, "only the owner can hide a transaction");
        }
        applyOverride(tx, actorId, "categoryMajor", tx.getCategoryMajorOverride(), request.categoryMajor(),
                tx::setCategoryMajorOverride);
        applyOverride(tx, actorId, "categoryMinor", tx.getCategoryMinorOverride(), request.categoryMinor(),
                tx::setCategoryMinorOverride);
        applyOverride(tx, actorId, "memo", tx.getMemoOverride(), request.memo(), tx::setMemoOverride);
        if (request.hidden() != null && request.hidden() != tx.isHidden()) {
            audits.save(new TransactionAudit(tx.getId(), actorId, "hidden",
                    Boolean.toString(tx.isHidden()), Boolean.toString(request.hidden())));
            tx.setHidden(request.hidden());
        }
        return views.toView(tx, true);
    }

    @Transactional(readOnly = true)
    public List<AuditView> audits(long viewerId, long transactionId) {
        LedgerTransaction tx = findVisible(viewerId, transactionId);
        List<TransactionAudit> rows = audits.findByTransactionIdOrderByChangedAtAscIdAsc(tx.getId());
        Set<Long> actorIds = rows.stream().map(TransactionAudit::getActorId).collect(Collectors.toSet());
        Map<Long, String> nicknames = users.findAllById(actorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        return rows.stream()
                .map(a -> new AuditView(a.getActorId(), nicknames.get(a.getActorId()), a.getField(),
                        a.getBeforeValue(), a.getAfterValue(), a.getChangedAt()))
                .toList();
    }

    /** 내 그 달 거래를 영구 삭제한다. 기본은 import 거래만, includeManual이면 수동 거래도 지운다. */
    @Transactional
    public MonthDeleteResult deleteMonth(long userId, YearMonth month, boolean includeManual) {
        Range range = monthRange(month);
        // 같은 회원의 업로드와 겹치지 않게 회원별 잠금을 잡은 뒤 지운다.
        ledgerLock.lockOwner(userId);
        int imported = transactions.deleteOwnedBetween(userId, TransactionSource.IMPORT, range.from(), range.to());
        int manual = includeManual
                ? transactions.deleteOwnedBetween(userId, TransactionSource.MANUAL, range.from(), range.to())
                : 0;
        return new MonthDeleteResult(imported, manual);
    }

    @Transactional
    public void deleteManual(long actorId, long transactionId) {
        LedgerTransaction tx = findVisible(actorId, transactionId);
        if (tx.getOwnerId() != actorId) {
            throw new ApiException(ErrorCode.FORBIDDEN, "only the owner can delete a transaction");
        }
        if (tx.getSource() != TransactionSource.MANUAL) {
            throw new ApiException(ErrorCode.CANNOT_DELETE_IMPORTED, "imported transactions can only be hidden");
        }
        transactions.delete(tx);
    }

    /** 볼 수 없는 거래는 존재 여부를 숨긴다(404). 숨긴 거래는 소유자만 볼 수 있다. */
    private LedgerTransaction findVisible(long viewerId, long transactionId) {
        LedgerTransaction tx = transactions.findById(transactionId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "transaction not found"));
        boolean owner = tx.getOwnerId() == viewerId;
        if (!owner && (tx.isHidden() || !access.canViewOwnedBy(viewerId, tx.getOwnerId()))) {
            throw new ApiException(ErrorCode.NOT_FOUND, "transaction not found");
        }
        return tx;
    }

    private void applyOverride(LedgerTransaction tx, long actorId, String field, String current, String requested,
                               Consumer<String> setter) {
        if (requested == null) {
            return;
        }
        String next = requested.isBlank() ? null : requested.strip();
        if (Objects.equals(current, next)) {
            return;
        }
        audits.save(new TransactionAudit(tx.getId(), actorId, field, current, next));
        setter.accept(next);
    }
}
