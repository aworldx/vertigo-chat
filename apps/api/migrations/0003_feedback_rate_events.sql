CREATE TABLE IF NOT EXISTS feedback_rate_events (
  identity_key text NOT NULL,
  sent_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_rate_events_identity_time_idx ON feedback_rate_events(identity_key,sent_at);
