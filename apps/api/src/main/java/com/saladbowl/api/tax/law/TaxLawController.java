package com.saladbowl.api.tax.law;

import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 누구나 읽는 적용된 세법 기준. 초안은 이 경로로 나가지 않는다. */
@RestController
public class TaxLawController {

    private final TaxLawService service;

    public TaxLawController(TaxLawService service) {
        this.service = service;
    }

    @GetMapping("/tax/law-versions/current")
    public VersionResponse current(@RequestParam @Min(1000) @Max(9999) int year) {
        return service.current(year);
    }
}
