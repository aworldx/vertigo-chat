CREATE TABLE IF NOT EXISTS geo_ranked_rounds (
 game_id text NOT NULL,
 round integer NOT NULL CHECK (round BETWEEN 1 AND 5),
 identity_key text NOT NULL CHECK (identity_key LIKE 'user:%'),
 nickname text NOT NULL,
 points integer NOT NULL CHECK (points BETWEEN 0 AND 3),
 awarded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (game_id, round, identity_key)
);
CREATE INDEX IF NOT EXISTS geo_ranked_rounds_identity_idx ON geo_ranked_rounds(identity_key);
