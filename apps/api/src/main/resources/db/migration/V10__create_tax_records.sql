-- 소득공제 자료. 회원 소유이며 연도 기록 아래에 카드 자료·현금영수증 자료·지출계획이 딸린다.
-- 금액은 원 단위 정수이고 상한은 화면의 금액 입력과 같은 9,999,999,999,999원이다.

-- 연도 기록의 세법 버전은 같은 귀속연도의 버전만 가리킨다(아래 복합 FK가 쓴다).
ALTER TABLE tax_law_versions ADD CONSTRAINT uq_tax_law_versions_id_year UNIQUE (id, tax_year);

CREATE TABLE tax_year_records (
    id               BIGSERIAL PRIMARY KEY,
    owner_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tax_year         INTEGER     NOT NULL,
    total_salary     BIGINT      NOT NULL CHECK (total_salary BETWEEN 1 AND 9999999999999),
    work_start_month INTEGER     NOT NULL CHECK (work_start_month BETWEEN 1 AND 12),
    work_end_month   INTEGER     NOT NULL CHECK (work_end_month BETWEEN work_start_month AND 12),
    child_count      INTEGER     NOT NULL DEFAULT 0 CHECK (child_count >= 0),
    -- NULL이면 그 귀속연도에 적용된 세법 버전이 아직 없다. 첫 버전이 적용될 때 채운다.
    law_version_id   BIGINT,
    row_version      BIGINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tax_year_records_owner_year UNIQUE (owner_id, tax_year),
    CONSTRAINT fk_tax_year_records_law_version FOREIGN KEY (law_version_id, tax_year)
        REFERENCES tax_law_versions (id, tax_year)
);

-- 신용·체크 자료. 카드사별로 여러 건이고 금액 칸의 NULL은 미입력(모름), 0은 없음이다.
CREATE TABLE tax_card_statements (
    id             BIGSERIAL PRIMARY KEY,
    record_id      BIGINT      NOT NULL REFERENCES tax_year_records (id) ON DELETE CASCADE,
    issuer_name    VARCHAR(50) NOT NULL,
    as_of_date     DATE        NOT NULL,
    memo           VARCHAR(200),
    credit_general BIGINT CHECK (credit_general BETWEEN 0 AND 9999999999999),
    credit_market  BIGINT CHECK (credit_market BETWEEN 0 AND 9999999999999),
    credit_transit BIGINT CHECK (credit_transit BETWEEN 0 AND 9999999999999),
    credit_culture BIGINT CHECK (credit_culture BETWEEN 0 AND 9999999999999),
    debit_general  BIGINT CHECK (debit_general BETWEEN 0 AND 9999999999999),
    debit_market   BIGINT CHECK (debit_market BETWEEN 0 AND 9999999999999),
    debit_transit  BIGINT CHECK (debit_transit BETWEEN 0 AND 9999999999999),
    debit_culture  BIGINT CHECK (debit_culture BETWEEN 0 AND 9999999999999),
    row_version    BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX idx_tax_card_statements_record ON tax_card_statements (record_id);

-- 현금영수증 자료. 연도 기록당 하나다. 행이 없으면 한 번도 입력하지 않은 것(4칸이 빈 미완료)이다.
CREATE TABLE tax_cash_receipts (
    record_id   BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE,
    as_of_date  DATE   NOT NULL,
    memo        VARCHAR(200),
    general     BIGINT CHECK (general BETWEEN 0 AND 9999999999999),
    market      BIGINT CHECK (market BETWEEN 0 AND 9999999999999),
    transit     BIGINT CHECK (transit BETWEEN 0 AND 9999999999999),
    culture     BIGINT CHECK (culture BETWEEN 0 AND 9999999999999),
    row_version BIGINT NOT NULL DEFAULT 0
);

-- 지출계획. 연도 기록당 하나다. 소비구분 4 x (신용카드 고정 / 체크카드·현금영수증 고정 / 변경 가능).
CREATE TABLE tax_spending_plans (
    record_id            BIGINT PRIMARY KEY REFERENCES tax_year_records (id) ON DELETE CASCADE,
    general_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (general_credit_fixed BETWEEN 0 AND 9999999999999),
    general_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (general_debit_fixed BETWEEN 0 AND 9999999999999),
    general_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (general_flexible BETWEEN 0 AND 9999999999999),
    market_credit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (market_credit_fixed BETWEEN 0 AND 9999999999999),
    market_debit_fixed   BIGINT NOT NULL DEFAULT 0 CHECK (market_debit_fixed BETWEEN 0 AND 9999999999999),
    market_flexible      BIGINT NOT NULL DEFAULT 0 CHECK (market_flexible BETWEEN 0 AND 9999999999999),
    transit_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (transit_credit_fixed BETWEEN 0 AND 9999999999999),
    transit_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (transit_debit_fixed BETWEEN 0 AND 9999999999999),
    transit_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (transit_flexible BETWEEN 0 AND 9999999999999),
    culture_credit_fixed BIGINT NOT NULL DEFAULT 0 CHECK (culture_credit_fixed BETWEEN 0 AND 9999999999999),
    culture_debit_fixed  BIGINT NOT NULL DEFAULT 0 CHECK (culture_debit_fixed BETWEEN 0 AND 9999999999999),
    culture_flexible     BIGINT NOT NULL DEFAULT 0 CHECK (culture_flexible BETWEEN 0 AND 9999999999999),
    row_version          BIGINT NOT NULL DEFAULT 0
);
