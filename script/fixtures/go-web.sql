INSERT INTO registered_users (nickname, password_hash, is_admin, can_moderate_emojis, is_game_guest, theme_id, appearance, font_id, font_style, message_sound_enabled, public_message_count, chat_seconds, karma, inserted_at, updated_at)
SELECT 'fixture' || lpad(number::text, 2, '0'), 'pbkdf2_sha256$2$c2FsdA$H2F1bw5i7upfSYTSkchLt-oxI5D0lR9WTT6YvjGNNRA', false, false, false, 'vertigo', '{}'::jsonb, 'theme', 'normal', false, 50, 18000, 0, '2026-09-01', '2026-09-01'
FROM generate_series(1, 13) AS number;
UPDATE profiles SET name='Тестовая анкета', about='Одинаковые данные для проверки перехода на Go.';
