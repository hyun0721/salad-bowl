CREATE TABLE import_batches (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    file_name      VARCHAR(255) NOT NULL,
    total_rows     INT          NOT NULL DEFAULT 0,
    created_rows   INT          NOT NULL DEFAULT 0,
    updated_rows   INT          NOT NULL DEFAULT 0,
    unchanged_rows INT          NOT NULL DEFAULT 0,
    imported_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_batches_owner ON import_batches (owner_id, imported_at DESC);

CREATE TABLE transactions (
    id                      BIGSERIAL PRIMARY KEY,
    owner_id                BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source                  VARCHAR(10)   NOT NULL CHECK (source IN ('IMPORT', 'MANUAL')),
    import_batch_id         BIGINT        REFERENCES import_batches (id) ON DELETE SET NULL,
    dedup_key               VARCHAR(64),
    occurred_at             TIMESTAMP     NOT NULL,
    type                    VARCHAR(10)   NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    category_major          VARCHAR(100)  NOT NULL,
    category_minor          VARCHAR(100)  NOT NULL,
    description             VARCHAR(500)  NOT NULL,
    amount                  NUMERIC(15, 2) NOT NULL,
    currency                VARCHAR(10)   NOT NULL,
    payment_method          VARCHAR(100)  NOT NULL,
    original_memo           VARCHAR(1000),
    category_major_override VARCHAR(100),
    category_minor_override VARCHAR(100),
    memo_override           VARCHAR(1000),
    hidden                  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_transactions_owner_dedup UNIQUE (owner_id, dedup_key),
    CONSTRAINT ck_transactions_dedup_source CHECK ((source = 'IMPORT') = (dedup_key IS NOT NULL))
);

CREATE INDEX idx_transactions_owner_occurred ON transactions (owner_id, occurred_at);

CREATE TABLE transaction_audits (
    id             BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT        NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
    actor_id       BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    field          VARCHAR(30)   NOT NULL,
    before_value   VARCHAR(1000),
    after_value    VARCHAR(1000),
    changed_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_audits_tx ON transaction_audits (transaction_id, changed_at);
