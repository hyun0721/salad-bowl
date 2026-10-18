package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.LedgerTransaction;
import com.saladbowl.api.transaction.LedgerTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 파싱된 행을 소유자의 기존 거래와 병합한다. 호출자의 트랜잭션 안에서 동작한다. */
@Service
public class MergeService {

    private static final int KEY_CHUNK = 1000;

    private final LedgerTransactionRepository transactions;

    public MergeService(LedgerTransactionRepository transactions) {
        this.transactions = transactions;
    }

    public record MergeCounts(int created, int updated, int unchanged) {
    }

    @Transactional
    public MergeCounts merge(long ownerId, long importBatchId, List<ParsedRow> rows) {
        List<String> keys = DedupKeys.keysFor(ownerId, rows);
        Map<String, LedgerTransaction> existing = findExisting(ownerId, keys);
        List<LedgerTransaction> toCreate = new ArrayList<>();
        int updated = 0;
        int unchanged = 0;
        for (int i = 0; i < rows.size(); i++) {
            LedgerTransaction current = existing.get(keys.get(i));
            if (current == null) {
                toCreate.add(LedgerTransaction.imported(ownerId, importBatchId, keys.get(i), rows.get(i).data()));
            } else if (current.refreshOriginal(rows.get(i).data())) {
                updated++;
            } else {
                unchanged++;
            }
        }
        transactions.saveAll(toCreate);
        return new MergeCounts(toCreate.size(), updated, unchanged);
    }

    private Map<String, LedgerTransaction> findExisting(long ownerId, List<String> keys) {
        Map<String, LedgerTransaction> byKey = new HashMap<>();
        for (int from = 0; from < keys.size(); from += KEY_CHUNK) {
            List<String> chunk = keys.subList(from, Math.min(from + KEY_CHUNK, keys.size()));
            for (LedgerTransaction tx : transactions.findByOwnerIdAndDedupKeyIn(ownerId, chunk)) {
                byKey.put(tx.getDedupKey(), tx);
            }
        }
        return byKey;
    }
}
