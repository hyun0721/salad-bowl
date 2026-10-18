package com.saladbowl.api.importer;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.importer.ImportDtos.ImportBatchView;
import com.saladbowl.api.importer.ImportDtos.ImportResult;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;

@RestController
public class ImportController {

    private static final int MAX_FILE_NAME = 255;

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PostMapping(path = "/imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> upload(@CurrentUser Long userId, @RequestParam("file") MultipartFile file)
            throws IOException {
        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().strip();
        if (file.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_FILE_FORMAT, "file is empty");
        }
        if (!fileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new ApiException(ErrorCode.INVALID_FILE_FORMAT, "only .xlsx files are supported");
        }
        String storedName = storedFileName(fileName);
        try (InputStream in = file.getInputStream()) {
            ImportResult result = importService.importFile(userId, storedName, in);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        }
    }

    @GetMapping("/imports")
    public List<ImportBatchView> history(@CurrentUser Long userId) {
        return importService.recent(userId);
    }

    /** 클라이언트가 보낸 경로는 버리고 마지막 조각만 남긴다. 길면 code point 단위로 자른다. */
    static String storedFileName(String original) {
        String last = original.substring(Math.max(original.lastIndexOf('/'), original.lastIndexOf('\\')) + 1);
        if (last.codePointCount(0, last.length()) <= MAX_FILE_NAME) {
            return last;
        }
        return last.substring(0, last.offsetByCodePoints(0, MAX_FILE_NAME));
    }
}
