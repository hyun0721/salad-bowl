package com.saladbowl.api.transaction;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.group.GroupAccess;
import com.saladbowl.api.transaction.TransactionDtos.AuditView;
import com.saladbowl.api.transaction.TransactionDtos.BulkUpdateResult;
import com.saladbowl.api.transaction.TransactionDtos.BulkUpdateTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.CategoryOption;
import com.saladbowl.api.transaction.TransactionDtos.CoverageMonth;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.MinorOption;
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
import java.util.Comparator;
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
    public List<TransactionView> myTransactions(long userId, YearMonth month, TransactionQuery query) {
        Range range = monthRange(month);
        return query.apply(views.toViews(transactions.findOwnedBetween(userId, range.from(), range.to()), owner -> true));
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
    public List<CategoryOption> categories(long userId) {
        return categoryOptions(transactions.countDisplayCategories(userId));
    }

    @Transactional(readOnly = true)
    public List<CategoryOption> groupCategories(long groupId, long userId) {
        access.requireMember(groupId, userId);
        List<Long> owners = access.sharedOwnerIds(groupId);
        return owners.isEmpty() ? List.of() : categoryOptions(transactions.countVisibleDisplayCategories(owners));
    }

    private List<CategoryOption> categoryOptions(List<Object[]> rows) {
        record CategoryKey(TransactionType type, String major) {}
        Map<CategoryKey, Map<String, Long>> byMajor = new HashMap<>();
        for (Object[] row : rows) {
            byMajor.computeIfAbsent(new CategoryKey((TransactionType) row[0], (String) row[1]), k -> new HashMap<>())
                    .merge((String) row[2], ((Number) row[3]).longValue(), Long::sum);
        }
        Comparator<CategoryOption> majorOrder = Comparator.comparingInt((CategoryOption c) -> switch (c.type()) {
                    case EXPENSE -> 0;
                    case INCOME -> 1;
                    case TRANSFER -> 2;
                }).thenComparing(Comparator.comparingLong(CategoryOption::count).reversed())
                .thenComparing(CategoryOption::major);
        Comparator<MinorOption> minorOrder = Comparator.comparingLong(MinorOption::count).reversed()
                .thenComparing(MinorOption::minor);
        return byMajor.entrySet().stream()
                .map(e -> new CategoryOption(
                        e.getKey().type(), e.getKey().major(),
                        e.getValue().values().stream().mapToLong(Long::longValue).sum(),
                        e.getValue().entrySet().stream()
                                .map(m -> new MinorOption(m.getKey(), m.getValue()))
                                .sorted(minorOrder)
                                .toList()))
                .sorted(majorOrder)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransactionView> groupTransactions(long groupId, long userId, YearMonth month, Long memberId,
                                                   TransactionQuery query) {
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
        return query.apply(views.toViews(transactions.findVisibleBetween(owners, range.from(), range.to()),
                owner -> editable.computeIfAbsent(owner, id -> access.canEditOwnedBy(userId, id))));
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
        updateOne(actorId, tx, request, tx.getOwnerId() == actorId
                || access.canEditOwnedBy(actorId, tx.getOwnerId()));
        return views.toView(tx, true);
    }

    @Transactional
    public BulkUpdateResult bulkUpdate(long actorId, BulkUpdateTransactionRequest request) {
        if (request.ids().size() != Set.copyOf(request.ids()).size()
                || request.type() == null && request.categoryMajor() == null
                && request.categoryMinor() == null && request.hidden() == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "invalid bulk update");
        }
        Map<Long, LedgerTransaction> byId = new HashMap<>();
        transactions.findAllById(request.ids()).forEach(tx -> byId.put(tx.getId(), tx));
        if (byId.size() != request.ids().size()) {
            throw new ApiException(ErrorCode.NOT_FOUND, "transaction not found");
        }
        // 수정 전에 전부 확인한다. 요청 순서대로 처리하면 앞 거래의 400·403이 뒤 id의 존재 여부를 드러낸다.
        Map<Long, Boolean> visible = new HashMap<>();
        for (LedgerTransaction tx : byId.values()) {
            if (tx.getOwnerId() != actorId && (tx.isHidden() || !visible.computeIfAbsent(tx.getOwnerId(),
                    ownerId -> access.canViewOwnedBy(actorId, ownerId)))) {
                throw new ApiException(ErrorCode.NOT_FOUND, "transaction not found");
            }
        }
        Map<Long, Boolean> editable = new HashMap<>();
        UpdateTransactionRequest update = new UpdateTransactionRequest(request.type(), request.categoryMajor(),
                request.categoryMinor(), null, request.hidden());
        for (long id : request.ids()) {
            LedgerTransaction tx = byId.get(id);
            updateOne(actorId, tx, update, tx.getOwnerId() == actorId || editable.computeIfAbsent(tx.getOwnerId(),
                    ownerId -> access.canEditOwnedBy(actorId, ownerId)));
        }
        return new BulkUpdateResult(request.ids().size());
    }

    private void updateOne(long actorId, LedgerTransaction tx, UpdateTransactionRequest request,
                           boolean editable) {
        boolean owner = tx.getOwnerId() == actorId;
        if (!editable) {
            throw new ApiException(ErrorCode.FORBIDDEN, "cannot edit this transaction");
        }
        if (!owner && request.hidden() != null) {
            throw new ApiException(ErrorCode.FORBIDDEN, "only the owner can hide a transaction");
        }
        if (request.type() == TransactionType.INCOME && tx.getType() != TransactionType.INCOME
                && tx.getAmount().signum() < 0) {
            // 금액 부호는 원본 그대로라 음수 수입은 그룹 수입을 줄인다.
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "a negative amount cannot be income");
        }
        if (request.type() != null) {
            TransactionType next = request.type() == tx.getType() ? null : request.type();
            if (next != tx.getTypeOverride()) {
                audits.save(new TransactionAudit(tx.getId(), actorId, "type", Objects.toString(tx.getTypeOverride(), null),
                        Objects.toString(next, null)));
                tx.setTypeOverride(next);
            }
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
