-- Shared fixtures in the two disposable comparison databases only.
INSERT INTO room_messages (room_id,kind,author,body,client_id,author_identity,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at)
SELECT 'lobby', 'text', 'feed-reader', body, 'feed-fixture-' || n, 'guest:feed-fixture', 'vertigo',
 CASE WHEN n=3 THEN '{"dark":{"nickname_color":"#c4b5fd","text_color":"#a7f3d0"},"light":{"nickname_color":"#123456","text_color":"#654321"}}'::jsonb ELSE '{}'::jsonb END,
 '{}'::jsonb, CASE WHEN n=3 THEN 'serif' ELSE 'theme' END, CASE WHEN n=3 THEN 'italic' ELSE 'normal' END,
 '2026-09-22 09:34:56Z', '2026-09-22 09:34:56Z', '2026-09-22 09:34:56Z'
FROM (VALUES (1, 'Короткое сообщение'), (2, 'Длинное сообщение — ' || repeat('читаем историю чата и сохраняем переносы слов ', 10)), (3, 'Цвета и шрифт сохранённого сообщения'), (4, '<script>alert("текст")</script> & https://example.com/path?x=1'), (5, repeat('длинноеслово', 35))) AS fixture(n, body);
INSERT INTO room_messages (room_id,kind,author,body,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at)
VALUES ('lobby','system','system','в чат заходит feed-reader','vertigo','{}','{}','theme','normal','2026-09-22 09:34:56Z','2026-09-22 09:34:56Z','2026-09-22 09:34:56Z');
-- Ensure scroll assertions exercise overflowing history even on the desktop.
INSERT INTO room_messages (room_id,kind,author,body,client_id,author_identity,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at)
SELECT 'lobby','text','feed-reader',repeat('История для проверки прокрутки. ',30),
 'feed-history-' || n,'guest:feed-fixture','vertigo','{}','{}','theme','normal',
 '2026-09-22 09:34:56Z','2026-09-22 09:34:56Z','2026-09-22 09:34:56Z'
FROM generate_series(1,7) n;
