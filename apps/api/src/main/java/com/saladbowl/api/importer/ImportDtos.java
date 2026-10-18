package com.saladbowl.api.importer;

import java.time.OffsetDateTime;

public final class ImportDtos {

    private ImportDtos() {
    }

    public record ImportResult(long batchId, int totalRows, int createdRows, int updatedRows, int unchangedRows) {
    }

    public record ImportBatchView(long batchId, String fileName, int totalRows, int createdRows, int updatedRows,
                                  int unchangedRows, OffsetDateTime importedAt) {

        static ImportBatchView from(ImportBatch batch) {
            return new ImportBatchView(batch.getId(), batch.getFileName(), batch.getTotalRows(),
                    batch.getCreatedRows(), batch.getUpdatedRows(), batch.getUnchangedRows(), batch.getImportedAt());
        }
    }
}
