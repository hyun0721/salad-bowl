package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.TransactionDtos.AuditView;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import com.saladbowl.api.transaction.TransactionDtos.UpdateTransactionRequest;
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

@RestController
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/me/transactions")
    public List<TransactionView> mine(@CurrentUser Long userId, @RequestParam YearMonth month) {
        return transactionService.myTransactions(userId, month);
    }

    @PostMapping("/me/transactions")
    public ResponseEntity<TransactionView> addManual(@CurrentUser Long userId,
                                                     @Valid @RequestBody ManualTransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transactionService.addManual(userId, request));
    }

    @GetMapping("/groups/{groupId}/transactions")
    public List<TransactionView> group(@CurrentUser Long userId, @PathVariable long groupId,
                                       @RequestParam YearMonth month,
                                       @RequestParam(required = false) Long memberId) {
        return transactionService.groupTransactions(groupId, userId, month, memberId);
    }

    @PatchMapping("/transactions/{transactionId}")
    public TransactionView update(@CurrentUser Long userId, @PathVariable long transactionId,
                                  @Valid @RequestBody UpdateTransactionRequest request) {
        return transactionService.update(userId, transactionId, request);
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
