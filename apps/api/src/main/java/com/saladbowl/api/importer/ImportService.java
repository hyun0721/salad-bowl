package com.saladbowl.api.importer;

import com.saladbowl.api.importer.ImportDtos.ImportBatchView;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;

@Service
public class ImportService {

    private final BanksaladParser parser;
    private final MergeService mergeService;
    private final ImportBatchRepository batches;

    public ImportService(BanksaladParser parser, MergeService mergeService, ImportBatchRepository batches) {
        this.parser = parser;
        this.mergeService = mergeService;
        this.batches = batches;
    }

    /** 파일 하나를 하나의 트랜잭션으로 반영한다. 파싱을 먼저 끝내므로 형식 오류면 아무것도 쓰지 않는다. */
    @Transactional
    public ImportResult importFile(long ownerId, String fileName, InputStream in) {
        List<ParsedRow> rows = parser.parse(in);
        ImportBatch batch = batches.save(new ImportBatch(ownerId, fileName));
        MergeService.MergeCounts counts = mergeService.merge(ownerId, batch.getId(), rows);
        batch.record(rows.size(), counts.created(), counts.updated(), counts.unchanged());
        return new ImportResult(batch.getId(), rows.size(), counts.created(), counts.updated(), counts.unchanged());
    }

    @Transactional(readOnly = true)
    public List<ImportBatchView> recent(long ownerId) {
        return batches.findTop20ByOwnerIdOrderByImportedAtDescIdDesc(ownerId).stream()
                .map(ImportBatchView::from)
                .toList();
    }
}
