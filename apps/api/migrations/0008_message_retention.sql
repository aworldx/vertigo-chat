-- Supports bounded retention cleanup across rooms. Existing (room_id, sent_at) supports history reads.
CREATE INDEX IF NOT EXISTS room_messages_retention_index ON room_messages (sent_at);
