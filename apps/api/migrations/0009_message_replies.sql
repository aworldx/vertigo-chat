-- A reply keeps a self-contained excerpt, so moderating or expiring the source
-- message never prevents the later public message from being read.
ALTER TABLE room_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id bigint,
  ADD COLUMN IF NOT EXISTS reply_author text,
  ADD COLUMN IF NOT EXISTS reply_body text;
