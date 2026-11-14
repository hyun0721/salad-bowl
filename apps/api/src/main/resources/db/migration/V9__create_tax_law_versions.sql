-- 연도별 세법 기준. 전역 데이터이며 회원 소유가 아니다. 초안(DRAFT)은 값이 비어 있을 수 있어 설정값은 NULL을 허용한다.
CREATE TABLE tax_law_versions (
    id                  BIGSERIAL PRIMARY KEY,
    tax_year            INTEGER      NOT NULL,
    version_no          INTEGER      NOT NULL,
    status              VARCHAR(10)  NOT NULL CHECK (status IN ('DRAFT', 'APPLIED')),
    algorithm_version   INTEGER      NOT NULL DEFAULT 1,
    min_spend_rate_pct  INTEGER,
    rate_credit_pct     INTEGER,
    rate_debit_cash_pct INTEGER,
    rate_culture_pct    INTEGER,
    rate_market_pct     INTEGER,
    rate_transit_pct    INTEGER,
    bracket_boundary    BIGINT,
    basic_limit_low_0   BIGINT,
    basic_limit_low_1   BIGINT,
    basic_limit_low_2   BIGINT,
    basic_limit_high_0  BIGINT,
    basic_limit_high_1  BIGINT,
    basic_limit_high_2  BIGINT,
    extra_limit_low     BIGINT,
    extra_limit_high    BIGINT,
    basis_law_name      VARCHAR(200),
    basis_article       VARCHAR(200),
    basis_url           VARCHAR(500),
    period_start        DATE,
    period_end          DATE,
    memo                VARCHAR(1000),
    created_by          BIGINT REFERENCES users (id) ON DELETE SET NULL,
    applied_by          BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    applied_at          TIMESTAMPTZ,
    row_version         BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_tax_law_versions_year_no UNIQUE (tax_year, version_no),
    -- 적용본에는 적용 시각이 있고 초안에는 없다. 현재 적용 버전을 applied_at으로 고르므로 DB에서도 지킨다.
    CONSTRAINT ck_tax_law_versions_applied_at CHECK ((status = 'APPLIED') = (applied_at IS NOT NULL))
);

-- 귀속연도별로 지금까지 내준 가장 큰 버전 번호. 초안을 지워도 줄지 않으므로 번호를 다시 쓰지 않는다.
CREATE TABLE tax_law_year_counters (
    tax_year        INTEGER PRIMARY KEY,
    last_version_no INTEGER NOT NULL
);
