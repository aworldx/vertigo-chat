-- Bot context owns limits and appearance. Missing rows retain environment/default values.
CREATE TABLE bot_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 daily_tokens integer NOT NULL CHECK (daily_tokens BETWEEN 0 AND 1000000000),
 stop_percent integer NOT NULL CHECK (stop_percent BETWEEN 1 AND 100)
);
CREATE TABLE bot_styles (
 bot_id text PRIMARY KEY CHECK (bot_id IN ('hitchcock', 'claire')),
 dark_nickname text NOT NULL CHECK (dark_nickname ~ '^#[0-9a-fA-F]{6}$'),
 dark_text text NOT NULL CHECK (dark_text ~ '^#[0-9a-fA-F]{6}$'),
 light_nickname text NOT NULL CHECK (light_nickname ~ '^#[0-9a-fA-F]{6}$'),
 light_text text NOT NULL CHECK (light_text ~ '^#[0-9a-fA-F]{6}$'),
 font text NOT NULL CHECK (font IN ('theme', 'sans', 'display', 'serif')),
 font_style text NOT NULL CHECK (font_style IN ('normal', 'italic'))
);
