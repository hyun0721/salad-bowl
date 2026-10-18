package com.saladbowl.api.transaction;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.transaction.SummaryDtos.MonthlySummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;

@RestController
public class SummaryController {

    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/groups/{groupId}/summary")
    public MonthlySummary monthly(@CurrentUser Long userId, @PathVariable long groupId,
                                  @RequestParam YearMonth month) {
        return summaryService.monthly(groupId, userId, month);
    }
}
