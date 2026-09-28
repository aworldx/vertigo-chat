-- Tetris owns results and rankings. Live rounds are cancelled on API restart.
CREATE TABLE tetris_results (
  id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('solo','versus')),
  finished_at timestamptz NOT NULL
);
CREATE TABLE tetris_scores (
  game_id text NOT NULL REFERENCES tetris_results(id),
  slot integer NOT NULL,
  user_id bigint NOT NULL,
  nickname text NOT NULL,
  score integer NOT NULL CHECK(score>=0),
  lines integer NOT NULL CHECK(lines>=0),
  level integer NOT NULL CHECK(level>=1),
  place integer NOT NULL CHECK(place BETWEEN 1 AND 3),
  PRIMARY KEY(game_id,slot)
);
CREATE INDEX tetris_scores_user ON tetris_scores(user_id,game_id);
CREATE INDEX tetris_results_date ON tetris_results(finished_at);
CREATE TABLE tetris_ratings (
  period text NOT NULL,
  user_id bigint NOT NULL,
  nickname text NOT NULL,
  rating double precision NOT NULL DEFAULT 1000,
  matches integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(period,user_id)
);
