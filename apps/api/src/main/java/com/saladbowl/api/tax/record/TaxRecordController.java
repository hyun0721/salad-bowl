package com.saladbowl.api.tax.record;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.tax.record.TaxRecordDtos.SavedYear;
import com.saladbowl.api.tax.record.TaxRecordDtos.TaxYearView;
import com.saladbowl.api.tax.record.TaxRecordDtos.YearRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인한 회원 본인의 소득공제 자료. 경로에 회원 id가 없고 항상 요청자의 자료만 다룬다. */
@RestController
@RequestMapping("/tax/years/{year}")
public class TaxRecordController {

    private final TaxRecordService service;

    public TaxRecordController(TaxRecordService service) {
        this.service = service;
    }

    @GetMapping
    public TaxYearView get(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        return service.get(userId, year);
    }

    @PutMapping
    public ResponseEntity<TaxYearView> save(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                            @Valid @RequestBody YearRequest request) {
        SavedYear saved = service.saveYear(userId, year, request);
        return ResponseEntity.status(saved.created() ? HttpStatus.CREATED : HttpStatus.OK).body(saved.view());
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        service.deleteYear(userId, year);
        return ResponseEntity.noContent().build();
    }
}
