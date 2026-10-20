package com.saladbowl.api.importer;

import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.importer.ImportDtos.ImportBatchView;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class ImportService {

    /** 한 파일의 첫 거래일과 마지막 거래일 차이의 상한(약 3개월). 7/1~9/30, 7/20~10/19 같은 "3개월" 범위를 받는다. */
    static final long MAX_PERIOD_DAYS = 92;

    private final BanksaladParser parser;
    private final MergeService mergeService;
    private final ImportBatchRepository batches;
    private final TransactionTemplate transaction;

    public ImportService(BanksaladParser parser, MergeService mergeService, ImportBatchRepository batches,
                         PlatformTransactionManager transactionManager) {
        this.parser = parser;
        this.mergeService = mergeService;
        this.batches = batches;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /**
     * 파일 하나를 하나의 트랜잭션으로 반영한다. 파싱과 기간 검사는 DB 커넥션을 잡기 전에 끝낸다
     * (형식·기간 오류면 아무것도 쓰지 않고, 풀러 연결을 파싱 시간 동안 붙잡지 않는다).
     */
    public ImportResult importFile(long ownerId, String fileName, InputStream in) {
        List<ParsedRow> rows = parser.parse(in);
        checkPeriod(rows);
        return transaction.execute(status -> {
            ImportBatch batch = batches.save(new ImportBatch(ownerId, fileName));
            MergeService.MergeCounts counts = mergeService.merge(ownerId, batch.getId(), rows);
            batch.record(rows.size(), counts.created(), counts.updated(), counts.unchanged());
            return new ImportResult(batch.getId(), rows.size(), counts.created(), counts.updated(), counts.unchanged());
        });
    }

    private static void checkPeriod(List<ParsedRow> rows) {
        if (rows.isEmpty()) {
            return;
        }
        LocalDate first = rows.getFirst().data().occurredAt().toLocalDate();
        LocalDate last = first;
        for (ParsedRow row : rows) {
            LocalDate day = row.data().occurredAt().toLocalDate();
            if (day.isBefore(first)) {
                first = day;
            }
            if (day.isAfter(last)) {
                last = day;
            }
        }
        if (ChronoUnit.DAYS.between(first, last) > MAX_PERIOD_DAYS) {
            throw new ApiException(ErrorCode.IMPORT_PERIOD_TOO_LONG,
                    "transactions span " + first + " to " + last + "; at most " + MAX_PERIOD_DAYS + " days per file");
        }
    }

    @Transactional(readOnly = true)
    public List<ImportBatchView> recent(long ownerId) {
        return batches.findTop20ByOwnerIdOrderByImportedAtDescIdDesc(ownerId).stream()
                .map(ImportBatchView::from)
                .toList();
    }
}
