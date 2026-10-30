package com.saladbowl.api.transaction;

import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.user.User;
import com.saladbowl.api.user.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/** 거래를 화면용 값으로 바꾼다. 소유자 닉네임은 한 번에 조회한다. */
@Component
public class TransactionViews {

    private final UserRepository users;

    public TransactionViews(UserRepository users) {
        this.users = users;
    }

    public List<TransactionView> toViews(List<LedgerTransaction> txs, Predicate<Long> editableOwner) {
        Set<Long> ownerIds = txs.stream().map(LedgerTransaction::getOwnerId).collect(Collectors.toSet());
        Map<Long, String> nicknames = users.findAllById(ownerIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
        return txs.stream()
                .map(tx -> view(tx, nicknames.get(tx.getOwnerId()), editableOwner.test(tx.getOwnerId())))
                .toList();
    }

    public TransactionView toView(LedgerTransaction tx, boolean editable) {
        String nickname = users.findById(tx.getOwnerId()).map(User::getNickname).orElse(null);
        return view(tx, nickname, editable);
    }

    private static TransactionView view(LedgerTransaction tx, String nickname, boolean editable) {
        Category category = tx.displayCategory();
        return new TransactionView(tx.getId(), tx.getOwnerId(), nickname, tx.getOccurredAt(), tx.displayType(),
                category.major(), category.minor(), tx.getDescription(), tx.getAmount(), tx.getCurrency(),
                tx.getPaymentMethod(), tx.displayMemo(), tx.isHidden(), tx.getSource(), tx.isEdited(), editable);
    }
}
