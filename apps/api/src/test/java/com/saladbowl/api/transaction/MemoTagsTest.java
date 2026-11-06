package com.saladbowl.api.transaction;

import org.junit.jupiter.api.Test;
import java.text.Normalizer;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class MemoTagsTest {
    @Test
    void specificationExamples() {
        assertThat(MemoTags.extract("예식장 #결혼준비 계약금")).containsExactly("결혼준비");
        assertThat(MemoTags.extract("a#b #ok, #한글_1")).containsExactly("ok", "한글_1");
        assertThat(MemoTags.add("", List.of("여행"))).isEqualTo("#여행");
        assertThat(MemoTags.add("숙소", List.of("여행", "제주"))).isEqualTo("숙소 #여행 #제주");
        assertThat(MemoTags.add("숙소 #여행", List.of("여행", "제주"))).isEqualTo("숙소 #여행 #제주");
        assertThat(MemoTags.remove("예식장 #결혼준비 계약금", List.of("결혼준비"))).isEqualTo("예식장 계약금");
        assertThat(MemoTags.remove("#여행 #제주", List.of("여행"))).isEqualTo("#제주");
        assertThat(MemoTags.remove("#여행", List.of("여행"))).isEmpty();
        assertThat(MemoTags.remove("숙소", List.of("여행"))).isEqualTo("숙소");
    }

    @Test
    void normalizationBoundariesAndOptionalHash() {
        String decomposed = Normalizer.normalize("결혼준비", Normalizer.Form.NFD);
        assertThat(MemoTags.extract("#" + decomposed + " #결혼준비 #A #a")).containsExactly("결혼준비", "A", "a");
        assertThat(MemoTags.extract("#" + "a".repeat(51))).isEmpty();
        assertThat(MemoTags.extract("#" + "a".repeat(50))).containsExactly("a".repeat(50));
        assertThat(MemoTags.extract(null)).isEmpty();
        assertThat(MemoTags.add(null, List.of("#결혼준비", decomposed))).isEqualTo("#결혼준비");
        assertThat(MemoTags.add("#" + decomposed, List.of("결혼준비"))).isEqualTo("#" + decomposed);
        assertThat(MemoTags.remove("#" + decomposed, List.of("#결혼준비"))).isEmpty();
        assertThat(MemoTags.remove(null, List.of("여행"))).isEmpty();
        assertThat(MemoTags.remove("숙소\n#여행\n끝", List.of("여행"))).isEqualTo("숙소\n\n끝");
        assertThat(MemoTags.remove("숙소  #여행 끝", List.of("여행"))).isEqualTo("숙소  끝");
        assertThat(MemoTags.remove("#여행 #제주", List.of("여행", "제주"))).isEmpty();
        for (String invalid : new String[]{"", "#", "##여행", "a b", "a-b", "a".repeat(51)}) {
            assertThatIllegalArgumentException().isThrownBy(() -> MemoTags.normalizeTag(invalid));
        }
        assertThatIllegalArgumentException().isThrownBy(() -> MemoTags.normalizeTag(null));
    }

    @Test
    void unicodeWhitespaceBeforeTagMatchesWeb() {
        for (String space : new String[]{"\u00A0", "\u3000", "\uFEFF", "\u2003", "\t", "\u000B"}) {
            assertThat(MemoTags.extract("숙소" + space + "#여행")).containsExactly("여행");
            assertThat(MemoTags.remove("숙소" + space + "#여행 끝", List.of("여행"))).isEqualTo("숙소 끝");
            assertThat(MemoTags.add("숙소" + space + "#여행", List.of("여행"))).isEqualTo("숙소" + space + "#여행");
        }
        assertThat(MemoTags.extract("a #b")).containsExactly("b");
        assertThat(MemoTags.extract("\u200B#여행")).isEmpty();
        assertThat(MemoTags.remove("\u00A0#여행 끝", List.of("여행"))).isEqualTo(" 끝");
        assertThat(MemoTags.add("숙소", List.of("여행"))).isEqualTo("숙소 #여행");
    }
}
