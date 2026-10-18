package com.saladbowl.api.importer;

import com.saladbowl.api.support.BanksaladWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 파서 정규화 + 키 계산 전체를 고정한다. 이 값이 바뀌면 이미 저장된 모든 dedup_key가 어긋난다.
 * 바꾸려면 데이터 마이그레이션이 필요하다.
 */
class ImportKeyGoldenTest {

    private static final String GOLDEN_KEY = "265539d5ba039b67e68937d68095a9490774d024d0bb2220b49cfe7c4f226cc9";
    private static final String GOLDEN_KEY_WITH_MEMO_AND_SECONDS =
            "88abd696de919dc92346a96a1a3ec56f1935dccdb3e1ec0862c11cbdf355ca2b";

    private static List<String> keysOf(BanksaladWorkbook workbook) {
        List<ParsedRow> rows = new BanksaladParser().parse(new ByteArrayInputStream(workbook.toBytes()));
        return DedupKeys.keysFor(1L, rows);
    }

    @Test
    void workbookRowKeepsItsGoldenKey() {
        assertThat(keysOf(BanksaladWorkbook.create()
                .row("2026-09-01", "12:00:00", "지출", "식비", "점심", "김밥", -4000, "카드", null)))
                .containsExactly(GOLDEN_KEY);
    }

    @Test
    void goldenKeyMatchesDirectKeyForSameValues() {
        // 같은 값(오너 1, 2026-09-01T12:00:00, -4000, 김밥, 카드)을 DedupKeysTest의 고정값과 맞춘다.
        assertThat(GOLDEN_KEY).isEqualTo(DedupKeysTest.PINNED_KEY);
    }

    @Test
    void secondsAndMemoRowKeepsItsGoldenKey() {
        assertThat(keysOf(BanksaladWorkbook.create()
                .row("2026-09-02", "19:58:25", "지출", "식비", "카페", "스타벅스", -7000, "신한카드", "메모")))
                .containsExactly(GOLDEN_KEY_WITH_MEMO_AND_SECONDS);
    }
}
