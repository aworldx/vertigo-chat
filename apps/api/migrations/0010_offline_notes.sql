CREATE TABLE IF NOT EXISTS offline_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id bigint NOT NULL REFERENCES registered_users(id) ON DELETE CASCADE,
  recipient_id bigint NOT NULL REFERENCES registered_users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  inserted_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  CONSTRAINT offline_notes_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT offline_notes_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS offline_notes_recipient_unread_idx
  ON offline_notes (recipient_id, inserted_at DESC, id DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS offline_notes_sender_idx
  ON offline_notes (sender_id, inserted_at DESC, id DESC);
