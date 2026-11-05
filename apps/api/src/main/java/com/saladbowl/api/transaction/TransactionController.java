package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.common.ApiException;
import com.saladbowl.api.common.ErrorCode;
import com.saladbowl.api.transaction.TransactionDtos.AuditView;
import com.saladbowl.api.transaction.TransactionDtos.BulkUpdateResult;
import com.saladbowl.api.transaction.TransactionDtos.BulkUpdateTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.CategoryOption;
import com.saladbowl.api.transaction.TransactionDtos.CoverageMonth;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.MonthDeleteResult;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.transaction.TransactionDtos.UpdateTransactionRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.util.List;
import java.util.Arrays;

@RestController
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/me/transactions")
    public List<TransactionView> mine(@CurrentUser Long userId, @RequestParam YearMonth month,
                                      HttpServletRequest request,
                                      @RequestParam(required = false) List<TransactionType> type,
                                      @RequestParam(defaultValue = "DATE_DESC") TransactionSort sort) {
        return transactionService.myTransactions(userId, month,
                transactionQuery(request, type, sort));
    }

    @GetMapping("/me/coverage")
    public List<CoverageMonth> coverage(@CurrentUser Long userId, @RequestParam int year) {
        return transactionService.coverage(userId, year);
    }

    @GetMapping("/me/categories")
    public List<CategoryOption> categories(@CurrentUser Long userId) {
        return transactionService.categories(userId);
    }

    @GetMapping("/groups/{groupId}/categories")
    public List<CategoryOption> groupCategories(@CurrentUser Long userId, @PathVariable long groupId) {
        return transactionService.groupCategories(groupId, userId);
    }

    @PostMapping("/me/transactions")
    public ResponseEntity<TransactionView> addManual(@CurrentUser Long userId,
                                                     @Valid @RequestBody ManualTransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transactionService.addManual(userId, request));
    }

    @DeleteMapping("/me/transactions")
    public MonthDeleteResult deleteMonth(@CurrentUser Long userId, @RequestParam YearMonth month,
                                         @RequestParam(defaultValue = "false") boolean includeManual) {
        return transactionService.deleteMonth(userId, month, includeManual);
    }

    @GetMapping("/groups/{groupId}/transactions")
    public List<TransactionView> group(@CurrentUser Long userId, @PathVariable long groupId,
                                       @RequestParam YearMonth month,
                                       @RequestParam(required = false) Long memberId,
                                       HttpServletRequest request,
                                       @RequestParam(required = false) List<TransactionType> type,
                                       @RequestParam(defaultValue = "DATE_DESC") TransactionSort sort) {
        return transactionService.groupTransactions(groupId, userId, month, memberId,
                transactionQuery(request, type, sort));
    }

    private TransactionQuery transactionQuery(HttpServletRequest request, List<TransactionType> type, TransactionSort sort) {
        // Spring의 List 바인딩은 단일 값을 쉼표로 나누므로 원본 파라미터를 읽어 빈 minor와 쉼표 든 major를 보존한다.
        String[] values = request.getParameterValues("exclude");
        List<TransactionQuery.Exclude> excludes = values == null ? List.of() : Arrays.stream(values).map(value -> {
            String[] fields = value.split("\t", -1);
            if (fields.length < 2 || fields.length > 3) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "invalid exclude");
            }
            try {
                return new TransactionQuery.Exclude(TransactionType.valueOf(fields[0]), fields[1],
                        fields.length == 3 ? fields[2] : null);
            } catch (IllegalArgumentException e) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "invalid exclude type", e);
            }
        }).toList();
        return new TransactionQuery(excludes, type, sort);
    }

    @PatchMapping("/transactions/{transactionId}")
    public TransactionView update(@CurrentUser Long userId, @PathVariable long transactionId,
                                  @Valid @RequestBody UpdateTransactionRequest request) {
        return transactionService.update(userId, transactionId, request);
    }

    @PatchMapping("/transactions/bulk")
    public BulkUpdateResult bulkUpdate(@CurrentUser Long userId,
                                       @Valid @RequestBody BulkUpdateTransactionRequest request) {
        return transactionService.bulkUpdate(userId, request);
    }

    @DeleteMapping("/transactions/{transactionId}")
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable long transactionId) {
        transactionService.deleteManual(userId, transactionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/transactions/{transactionId}/audits")
    public List<AuditView> audits(@CurrentUser Long userId, @PathVariable long transactionId) {
        return transactionService.audits(userId, transactionId);
    }
}
