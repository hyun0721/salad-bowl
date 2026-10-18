package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.TransactionDtos.ManualTransactionRequest;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
}
