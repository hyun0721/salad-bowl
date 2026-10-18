CREATE TABLE group_bans (
    id        BIGSERIAL PRIMARY KEY,
    group_id  BIGINT      NOT NULL REFERENCES user_groups (id) ON DELETE CASCADE,
    user_id   BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    banned_by BIGINT      NOT NULL REFERENCES users (id),
    banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_group_bans_group_user UNIQUE (group_id, user_id)
);
