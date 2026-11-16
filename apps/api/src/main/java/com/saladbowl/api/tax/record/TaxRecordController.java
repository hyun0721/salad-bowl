package com.saladbowl.api.tax.record;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.tax.record.TaxRecordDtos.CardRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.CashRequest;
import com.saladbowl.api.tax.record.TaxRecordDtos.PlanRequest;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ResponseEntity<Void> delete(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                        @RequestParam long rowVersion) {
        service.deleteYear(userId, year, rowVersion);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cards")
    public ResponseEntity<TaxYearView> addCard(@CurrentUser Long userId,
                                               @PathVariable @Min(1000) @Max(9999) int year,
                                               @Valid @RequestBody CardRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addCard(userId, year, request));
    }

    @PutMapping("/cards/{cardId}")
    public TaxYearView updateCard(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                  @PathVariable long cardId, @Valid @RequestBody CardRequest request) {
        return service.updateCard(userId, year, cardId, request);
    }

    @DeleteMapping("/cards/{cardId}")
    public ResponseEntity<Void> deleteCard(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                           @PathVariable long cardId, @RequestParam long rowVersion) {
        service.deleteCard(userId, year, cardId, rowVersion);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/cash-receipt")
    public TaxYearView saveCashReceipt(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                       @Valid @RequestBody CashRequest request) {
        return service.saveCashReceipt(userId, year, request);
    }

    @PutMapping("/plan")
    public TaxYearView savePlan(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year,
                                @Valid @RequestBody PlanRequest request) {
        return service.savePlan(userId, year, request);
    }

    @PostMapping("/law-version/refresh")
    public TaxYearView refreshLawVersion(@CurrentUser Long userId, @PathVariable @Min(1000) @Max(9999) int year) {
        return service.refreshLawVersion(userId, year);
    }
}
