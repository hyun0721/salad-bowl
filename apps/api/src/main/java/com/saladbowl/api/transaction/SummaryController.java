package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.SummaryDtos.CategoryTrend;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import com.saladbowl.api.transaction.TransactionDtos.TransactionView;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.util.List;

@RestController
public class SummaryController {

    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/groups/{groupId}/summary/subcategories")
    public List<SummaryDtos.SubcategoryMonth> subcategories(
            @CurrentUser Long userId, @PathVariable long groupId, @RequestParam YearMonth month,
            @RequestParam(required = false) YearMonth from) {
        return summaryService.subcategories(groupId, userId, month, from);
    }

    @GetMapping("/groups/{groupId}/summary")
    public MonthlySummary monthly(@CurrentUser Long userId, @PathVariable long groupId,
                                  @RequestParam YearMonth month) {
        return summaryService.monthly(groupId, userId, month);
    }

    @GetMapping("/groups/{groupId}/summary/trend")
    public CategoryTrend trend(@CurrentUser Long userId, @PathVariable long groupId,
                               @RequestParam YearMonth from, @RequestParam YearMonth to) {
        return summaryService.trend(groupId, userId, from, to);
    }

    @GetMapping("/groups/{groupId}/summary/transactions")
    public List<TransactionView> categoryTransactions(@CurrentUser Long userId, @PathVariable long groupId,
                                                      @RequestParam YearMonth month,
                                                      @RequestParam String category) {
        return summaryService.categoryTransactions(groupId, userId, month, category);
    }
}
