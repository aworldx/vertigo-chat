# Лимиты материалов по званию — макеты 2026-10-25

Статус: оригинальные макеты подготовлены до реализации. Финальная визуальная приёмка ещё не проведена.

## Объём и шкала

Общий лимит каждой из трёх коллекций отдельно: **1, 2, 3, 5, 8, 12, 18, 25, 35, 50** по десяти существующим званиям. Публикация статей и фото доступна зарегистрированным участникам с первого звания. Суточные квоты материалов удаляются. Правила загрузки изображений внутри статей не входят в эту задачу.

Изменяется только текст в существующих интерфейсах и добавляется строка лимитов в существующие карточки званий. Глобальные стили, фоны, навигация, сетки, формы, controls, размеры и состояния сохраняются.

## Точная реализация

1. `Help.tsx`: после `dl` внутри того же `div.min-w-0` добавить `<p className="mt-4 text-xs leading-5 text-zinc-400">Общие лимиты: хит-парад — {rank.limits.tracks}, статьи — {rank.limits.articles}, фото — {rank.limits.photos}.</p>`. Старые feature unlock для библиотеки/фото не выводятся. На desktop строки помещаются в одну строку; на tablet и mobile естественный перенос на две строки сохраняется.
2. `MusicChart.tsx`: существующий абзац `mt-2 text-sm leading-6 text-zinc-400` заменить на `Общий лимит треков зависит от звания. Подробности — в помощи.`
3. `Editor.tsx`: существующий абзац `mt-1 text-xs text-stone-500` в preview заменить на `Общий лимит статей зависит от звания. Подробности — в помощи.`
4. `Gallery.tsx`: существующий вводный абзац после h1 заменить на `Общая коллекция снимков чатлан. Общий лимит фотографий зависит от звания. Подробности — в помощи.`
5. Никаких дополнительных CSS, новых декоративных блоков или новых функций. Поясняющие тексты — обычный текст в прежней типографике.
6. Старые сообщения про `Киноман` / `Статист` в denied/error ветках заменить на `Добавлять статьи могут зарегистрированные чатлане.` / `Добавлять фото могут зарегистрированные чатлане.`. Ошибки квоты сообщают, что общий лимит текущего звания исчерпан; подробности — в разделе «Система званий». Удаление материалов не обещается: в текущем UI его нет. Эти transient error состояния проверяются функциональным verifier; раскладка существующего alert не меняется.

## Артефакты и воспроизведение

Абсолютный корень: `/Users/amirhasanov/Projects/chat/docs/design/rank-limits-20261025`.

Оригинальные PNG: `mock/{surface}-{width}-{state}.png`. Каждый screenshot ровно viewport-sized; размеры **1440×900, 768×1024, 390×844**, Chromium Linux, deviceScaleFactor 1, browser zoom 100%, ru-RU, dark scheme. Прямой список путей, route, auth, fixture и scrollY сохранён в `mock/manifest.json`.

Поверхности:
- `ranks`: `/help`, состояния `start` (заголовок званий на y=24) и `end` (нижняя граница списка).
- `chart`: `/music-chart`, `top` и `form` (прокрутка к панели загрузки, ограниченная max scroll).
- `gallery`: `/gallery`, `top`.
- `editor`: `/library`, открытая Новая статья, пустые поля; desktop обе колонки, tablet/mobile вкладка Предпросмотр; `top`, `viewport`, `bottom` внутри `#library-editor`. Совпадение состояний на низком preview ожидаемо: высота содержимого меньше viewport.

Auth: intercept `/api/v1/auth/session` с registered fixture01, user_id 1, roles []; коллекции пустые, can_publish/can_upload=true. Реальные production CSS/JS/fonts/assets получены из Docker http://127.0.0.1:4063. Макеты изменяют только DOM-тексты согласно спецификации; исходники приложения при их создании не менялись. Ранги используют реальные названия, пороги, иконки, предложенные лимиты и отсутствие устаревших unlock.

Ресурсы сохранены исходными: `/fonts/oswald-variable.ttf` (Vertigo Display), `/fonts/manrope-variable.ttf` (Vertigo Text), `/fonts/cormorant-garamond-variable.ttf` (Library Serif), `/images/spiral.png`, `/images/noir-hero.png`, `/images/library-room-v2.png`, `/images/ranks/*.svg`; CSS градиенты/кольца остаются исходными. Позиция/кроп/opacity/background layering фиксируются исходными PNG и существующим CSS. Новых ресурсов нет.

Для current capture главный агент после verifier запускает неизменённый `capture.mjs` с `CAPTURE_MODE=current`. В этом режиме DOM не трансформируется. Пример: `docker run --rm --shm-size=1g -e CAPTURE_MODE=current -v /Users/amirhasanov/Projects/chat:/workspace -w /app chat-quality:local node /workspace/docs/design/rank-limits-20261025/capture.mjs`. Любая целевая browser-проверка реализации принадлежит основному агенту через skill verifier.

## Критерии итоговой приёмки

Для **каждого** viewport и каждого PNG-состояния:
- PASS/FAIL: chrome и навигация совпадают с baseline; единственные изменения — согласованный текст и высота карточек званий по mock.
- PASS/FAIL: блоки и первый экран совпадают с mock, заголовки/иконки/контролы не сдвинуты произвольно.
- PASS/FAIL: font-family/weight/size/line-height, текстовые переносы и цвет совпадают с mock.
- PASS/FAIL: фон и каждый asset идентичны; lamp/room в редакторе остаются исходной композицией с теми же crop/anchor/layering.
- PASS/FAIL: controls и disabled states соответствуют fixture; клавиатура/hover/focus сохранены.
- PASS/FAIL: горизонтального overflow нет.
- PASS/FAIL: scroll start/end для ranks, top/form для chart и top/viewport/bottom для editor соответствуют mock и не перекрывают controls.

После функционального verifier дизайнер открывает оригинал mock PNG, current Docker PNG и side-by-side плюс overlay/diff на каждом viewport. Без любого артефакта, при другой auth/data/размере или визуальном расхождении итог REJECTED. В текущем этапе приёмка реализации не заявляется.

## Дополнительные исходные макеты

`mock-extra/` содержит по три viewport для library-denied, gallery-denied, landing-benefits, landing-library, landing-gallery, landing-music-chart. `mock-extra/manifest.json` фиксирует данные и scroll. Защитные denied states моделируются can_publish=false/can_upload=false для зарегистрированного fixture01: в нормальном happy path новые backend-правила всегда дают true. Capture `capture-extra.mjs` запускается с `CAPTURE_MODE=current-extra` для получения текущего UI без DOM transforms.

Точный дополнительный текст `landing/content.ts`:

- benefits[1]: «Копи публичные фразы и часы в чате: звания увеличивают лимиты материалов, а результаты игр остаются в рейтингах.»
- benefits[2]: «Оформи анкету, отправляй фото и аудио, оставляй записки. После регистрации добавляй фото в альбом и статьи в библиотеку; общий лимит зависит от звания.»
- library card: «Статьи и серии от участников. Читай, ставь лайки и сохраняй закладки после входа. Публикуй свои тексты после регистрации; общий лимит зависит от звания.»
- gallery card: «Смотри и оценивай фотографии чатлан. Загружай свои снимки после регистрации; общий лимит зависит от звания.»
- music-chart card: «Слушай, оценивай и обсуждай треки. После входа добавляй свои записи; общий лимит зависит от звания. На компьютере отправляй весь топ в очередь плеера чата.»

Общие критерии приёмки также обязательны для всех дополнительных PNG. Артефакты FROZEN/FROZEN-extra защищают оригиналы от перезаписи capture-скриптами.
