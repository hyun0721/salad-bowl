package com.saladbowl.api.tax.law;

import com.saladbowl.api.auth.CurrentUser;
import com.saladbowl.api.tax.law.TaxLawDtos.CreateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.UpdateRequest;
import com.saladbowl.api.tax.law.TaxLawDtos.VersionResponse;
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

import java.util.List;

/** 서비스 관리자 전용. 권한은 TaxAdminInterceptor가 /tax/admin/** 에서 요청마다 DB로 확인한다. */
@RestController
@RequestMapping("/tax/admin/law-versions")
public class TaxLawAdminController {

    private final TaxLawService service;

    public TaxLawAdminController(TaxLawService service) {
        this.service = service;
    }

    @GetMapping
    public List<VersionResponse> list(@RequestParam @Min(1000) @Max(9999) int year) {
        return service.list(year);
    }

    @PostMapping
    public ResponseEntity<VersionResponse> create(@CurrentUser Long userId,
                                                  @Valid @RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDraft(userId, request.taxYear()));
    }

    @GetMapping("/{id}")
    public VersionResponse get(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public VersionResponse update(@PathVariable long id, @Valid @RequestBody UpdateRequest request) {
        return service.updateDraft(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.deleteDraft(id);
        return ResponseEntity.noContent().build();
    }
}
