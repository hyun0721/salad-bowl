package com.saladbowl.api.importer;

import com.saladbowl.api.support.LargeBanksaladWorkbook;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.unit.DataSize;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `./gradlew memoryTest`(heap 192MB)로만 돈다. 업로드 상한 근처의 대표 파일(shared strings, 10개 열)을
 * 배포 인스턴스보다 작은 heap에서 읽는 회귀 검증이다. 다른 구성(긴 메모, 많은 고유 문자열)의 모든 파일을 보장하지는 않는다.
 */
@Tag("memory")
class BanksaladParserMemoryTest {

    private static final long UPLOAD_LIMIT_BYTES = 512L * 1024;

    /** 서버 업로드 한도를 올리면 이 테스트의 파일 크기 범위도 함께 올려 다시 확인해야 한다. */
    @Test
    void uploadLimitMatchesTheSizeVerifiedHere() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        String configured = yaml.getObject().getProperty("spring.servlet.multipart.max-file-size");

        assertThat(DataSize.parse(configured).toBytes()).isEqualTo(UPLOAD_LIMIT_BYTES);
    }

    @Test
    void parsesAFileNearTheUploadLimitWithinASmallHeap(@TempDir Path dir) throws Exception {
        Path file = dir.resolve("near-limit.xlsx");
        LargeBanksaladWorkbook.write(file, 10_000);
        assertThat(Files.size(file)).isBetween(400L * 1024, UPLOAD_LIMIT_BYTES);

        List<ParsedRow> rows;
        try (InputStream in = Files.newInputStream(file)) {
            rows = new BanksaladParser().parse(in);
        }

        assertThat(rows).hasSize(10_000);
        assertThat(rows.get(9_999).rowNumber()).isEqualTo(10_001);
    }
}
