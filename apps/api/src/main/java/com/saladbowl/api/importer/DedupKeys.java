package com.saladbowl.api.importer;

import com.saladbowl.api.transaction.TransactionData;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * 거래 중복 키: SHA-256(owner, 일시, 금액, 내용, 결제수단, seq).
 * seq는 한 파일 안에서 앞의 다섯 값이 같은 행의 순번(0부터)이라, 같은 시각·금액의 반복 결제를 구분한다.
 * 카테고리와 메모는 키에 넣지 않는다(앱에서 바뀔 수 있다).
 */
public final class DedupKeys {

    private static final String SEPARATOR = "\u001F";

    private DedupKeys() {
    }

    public static List<String> keysFor(long ownerId, List<ParsedRow> rows) {
        Map<String, Integer> occurrences = new HashMap<>();
        List<String> keys = new ArrayList<>(rows.size());
        for (ParsedRow row : rows) {
            String identity = identity(ownerId, row.data());
            int seq = occurrences.merge(identity, 1, Integer::sum) - 1;
            keys.add(sha256(identity + SEPARATOR + seq));
        }
        return keys;
    }

    private static String identity(long ownerId, TransactionData data) {
        return String.join(SEPARATOR,
                Long.toString(ownerId),
                data.occurredAt().toString(),
                data.amount().toPlainString(),
                data.description(),
                data.paymentMethod());
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
