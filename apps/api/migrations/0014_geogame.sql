-- Only the current room game is retained. No game answers enter chat history.
CREATE TABLE geo_room_games (
    room_id text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
