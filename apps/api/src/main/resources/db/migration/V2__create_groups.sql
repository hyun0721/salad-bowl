CREATE TABLE user_groups (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,
    created_by BIGINT      NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    id            BIGSERIAL PRIMARY KEY,
    group_id      BIGINT      NOT NULL REFERENCES user_groups (id) ON DELETE CASCADE,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
    share_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_group_members_group_user UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);

CREATE TABLE group_invites (
    id         BIGSERIAL PRIMARY KEY,
    group_id   BIGINT      NOT NULL REFERENCES user_groups (id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,
    created_by BIGINT      NOT NULL REFERENCES users (id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_invites_group ON group_invites (group_id);
