# Анкеты и портреты ботов

Анкеты создаются data-миграцией `apps/api/migrations/0005_bot_profiles.sql`
в `registered_users` и `profiles` и доступны в обычном каталоге, публичном API
и окне чата. Звезда Клэр и камера Хичкока открывают анкеты.

`is_bot` запрещает вход под персонажем и исключает его из выборов первого
администратора. Пароль непригоден для аутентификации. Описания без технических
пометок, как просил пользователь. Миграция не захватывает занятые человеком ники.
Повторный запуск мигратора сохраняет описания, статистику и карму.

Текстовые реплики, включая ответы и фоновую беседу, атомарно увеличивают
`public_message_count` один раз; уже сохранённые реплики учтены при создании.
Кармик находит персонажей как обычные аккаунты и сохраняет их карму в БД.
Heartbeat раз в 30 секунд учитывает время присутствия, защищён от нескольких
реплик API и не начисляет время за длительный простой. Короткий разрыв до 90 секунд
считается непрерывным присутствием.

Оригиналы и WebP-миниатюры загружены в настроенный Selectel S3; каждый PUT
проверен публичным GET с побайтовым сравнением. Ключи объектов зафиксированы
в data-миграции. Приложение использует обычный маршрут фото анкеты через S3.
Локальные оригиналы ниже — исходные материалы, не источник выдачи фото.

На 2026-09-25 миграция применена только к `chat_autumn_preview_20260924`;
production-БД не менялась. Для нового окружения требуется настроенный S3
с этими объектами перед применением миграции.

## Хичкок

Файл: `docs/assets/bots/hitchcock.jpg`.
Настоящая фотография Alfred Hitchcock, CBS Television, 2 сентября 1955.
Источник: https://commons.wikimedia.org/wiki/File:Alfred_Hitchcock_1955.jpg
Оригинал: https://upload.wikimedia.org/wikipedia/commons/9/9a/Alfred_Hitchcock_1955.jpg
Commons обозначает изображение как public domain in the United States (PD-US-no-notice).
Изображение сохранено без изменений.

## Клэр

Файл: `docs/assets/bots/claire.png`.
Вымышленный взрослый персонаж. Создано встроенным инструментом imagegen;
CLI/API fallback не использовался. По просьбе пользователя описания анкет содержат
только тексты персонажей, без технических пометок о ботах и генерации.

Промпт:

> Use case: photorealistic-natural. Asset type: fictional chat character profile portrait. Create a realistic photographic head-and-shoulders portrait of Claire, a fictional adult 24-year-old aspiring actress who just moved to a big city for auditions. Warm spontaneous laugh, lively eyes, approachable and subtly playful expression, natural skin texture, light everyday makeup, casual tasteful clothes. Soft natural window light, softly blurred urban cafe background, authentic casting headshot feel, centered face with room around head, square composition. No text, logos or watermark. Not a likeness of any real celebrity.
