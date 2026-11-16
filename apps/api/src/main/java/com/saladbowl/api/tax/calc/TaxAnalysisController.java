package com.saladbowl.api.tax.calc;

import com.saladbowl.api.auth.CurrentUser;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 본인의 소득공제 분석. 경로에 회원 id가 없고 항상 요청자의 연도 기록만 계산한다. */
@RestController
public class TaxAnalysisController {

    private final TaxAnalysisService service;

    public TaxAnalysisController(TaxAnalysisService service) {
        this.service = service;
    }

    @GetMapping("/tax/years/{year}/analysis")
    public TaxAnalysisView get(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        return service.get(userId, year);
    }
}
