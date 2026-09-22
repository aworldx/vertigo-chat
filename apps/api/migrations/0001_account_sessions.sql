CREATE TABLE account_sessions (
    token_digest text PRIMARY KEY,
    user_id bigint REFERENCES registered_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX account_sessions_expiry ON account_sessions (expires_at);
CREATE INDEX account_sessions_user ON account_sessions (user_id);
