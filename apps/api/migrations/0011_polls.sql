CREATE TABLE IF NOT EXISTS polls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by bigint NOT NULL REFERENCES registered_users(id),
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  closed_at timestamptz,
  CONSTRAINT polls_question_not_blank CHECK (length(btrim(question)) > 0),
  CONSTRAINT polls_question_length CHECK (char_length(question) <= 500),
  CONSTRAINT polls_closed_timestamp CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS poll_options (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_id bigint NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  body text NOT NULL,
  position integer NOT NULL,
  UNIQUE (poll_id, position),
  CONSTRAINT poll_options_body_not_blank CHECK (length(btrim(body)) > 0),
  CONSTRAINT poll_options_body_length CHECK (char_length(body) <= 200)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id bigint NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  option_id bigint NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voted_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  PRIMARY KEY (poll_id, nickname),
  CONSTRAINT poll_votes_nickname_not_blank CHECK (length(btrim(nickname)) > 0)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_idx ON poll_options (poll_id, position);
CREATE INDEX IF NOT EXISTS poll_votes_poll_option_idx ON poll_votes (poll_id, option_id);
