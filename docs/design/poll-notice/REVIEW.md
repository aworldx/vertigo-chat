# Приглашение в опрос — диагностика и визуальная приёмка

Дата: 2026-10-04. Маршруты `/chat` и `/polls`. Итог: **APPROVED**.

## Воспроизведённые причины

1. Именованное окно `vertigo-polls`, открытое до входа в чат, сохраняет пустой sessionStorage при повторном открытии. Варианты disabled. Это воспроизведено реальным browser-сценарием на 1440 и 390 px; исходные снимки `1440-disabled.png` и `390-disabled.png`. Открытие из меню/приглашения теперь копирует текущую сессию непосредственно в same-origin окно до навигации; токен не попадает в URL или localStorage. При блокировке popup используется текущая вкладка.
2. PostgreSQL List сохранял SelectedOptionID только из первой строки вариантов. Голос за второй вариант записывался, но выдавался как отсутствующий. Регрессионный тест до исправления: `selection for "voter-Нет": got 0, want 2`; после исправления проходит. Выбор берётся из любой строки соответствующего опроса. Существующие голоса исправления данных не требуют.
3. Приглашение было постоянным последним child ленты и не имело закрытия. Теперь оно привязано к сообщениям на момент получения, обновление списка опросов не перемещает его вниз. Закрытие сохраняется в sessionStorage по нику. При загрузке приглашение ждёт первоначальную историю.

Конкретная production-сессия Френчи не исследовалась; приведены воспроизведённые причины, а не утверждение о её действиях. Production и пользовательские голоса не менялись.

## Исходный макет и фиксация условий

PNG `*-mock.png` и `*-mock-{top,middle,bottom}.png` сохранены до UI-реализации через `visual.mjs mock`, на основе baseline текущего Docker-интерфейса. Дизайнерский прототип менял только приглашение. Повторная генерация mock после реализации для приёмки запрещена.

Фиксированный visual fixture: guest `Участник`, один self peer, тема `autumn`, Кармик скрыт; три сообщения `Собеседник`, затем snapshot из 40 сообщений. Время сообщений `2026-10-04T09:00:00Z`, один открытый опрос «Какой сценарий проверить?». Browser locale ru-RU, timezone Europe/Moscow, zoom 100%, deviceScaleFactor 1, reducedMotion reduce. Данные WebSocket и приватного списка опросов детерминированы в Playwright; сборка страницы и assets доставлены реальным Go-сервером Docker. Эти visual fixtures не заменяют функциональные сценарии с реальной БД ниже.

Ресурсы относительно репозитория: `apps/web/public/fonts/manrope-variable.ttf`, `apps/web/public/fonts/oswald-variable.ttf`, `apps/web/public/images/autumn-forest.svg`, `apps/web/public/images/spiral.png`; CSS baseline: `apps/web/css/site.css`, `apps/web/css/autumn.css`. Новые изображения и шрифты не добавлены.

Критерии макета: существующие шапка, фон, типографика сообщений и composer сохраняются; карточка в обычном потоке после третьего сообщения, margin-top 12px, padding 12px, gap 12px, border 1px #3f3f46, radius 8px, background #18181b, текст 12px/20px, ссылка amber, кнопка закрытия 32×32px. Desktop/tablet — одна строка; на mobile ссылка переносится. Новые сообщения ниже блока. Закрытие убирает блок без пустого места. Горизонтального переполнения нет.

## Строгая визуальная проверка

Каждый оригинальный PNG, текущий Docker PNG, side-by-side и overlay лично открыт в одной review-сессии. После исправления гонки загрузки во всех 12 парах — 0 пикселей с разницей каналов >8. В каждом ряду проверены: chrome, первый viewport и высоты блоков, шрифты, фон и его crop/anchor/layering, элементы управления, отсутствие overflow, состояние прокрутки. Отличительные фоновые ресурсы не заменены. Все перечисленные пункты — PASS.

Scroll принадлежит `#messages`; window.scrollY=0. `initial`: 3 сообщения, top=0; `top`: 40 сообщений, top=0; `middle`: top=clientHeight; `bottom`: нижняя граница истории. Шапка остаётся y=0..56, лента начинается y=56; карточка в initial/top y=266, высота 58px на desktop/tablet, 66px mobile. В middle/bottom приглашение выше видимой области, а лента заполнена сообщениями. Composer сохраняет свою исходную позицию и ничего не перекрывает.

| Viewport / состояние | Исходный макет | Docker PNG | Side-by-side | Overlay | Результат всех критериев |
|---|---|---|---|---|---|
| 1440×900 / initial | [1440-mock.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-mock.png) | [1440-actual.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-actual.png) | [1440-side.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-side.png) | [1440-overlay.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-overlay.png) | PASS |
| 1440×900 / top | [1440-mock-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-mock-top.png) | [1440-actual-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-actual-top.png) | [1440-side-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-side-top.png) | [1440-overlay-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-overlay-top.png) | PASS |
| 1440×900 / middle | [1440-mock-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-mock-middle.png) | [1440-actual-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-actual-middle.png) | [1440-side-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-side-middle.png) | [1440-overlay-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-overlay-middle.png) | PASS |
| 1440×900 / bottom | [1440-mock-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-mock-bottom.png) | [1440-actual-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-actual-bottom.png) | [1440-side-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-side-bottom.png) | [1440-overlay-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/1440-overlay-bottom.png) | PASS |
| 768×1024 / initial | [768-mock.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-mock.png) | [768-actual.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-actual.png) | [768-side.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-side.png) | [768-overlay.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-overlay.png) | PASS |
| 768×1024 / top | [768-mock-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-mock-top.png) | [768-actual-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-actual-top.png) | [768-side-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-side-top.png) | [768-overlay-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-overlay-top.png) | PASS |
| 768×1024 / middle | [768-mock-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-mock-middle.png) | [768-actual-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-actual-middle.png) | [768-side-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-side-middle.png) | [768-overlay-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-overlay-middle.png) | PASS |
| 768×1024 / bottom | [768-mock-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-mock-bottom.png) | [768-actual-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-actual-bottom.png) | [768-side-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-side-bottom.png) | [768-overlay-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/768-overlay-bottom.png) | PASS |
| 390×844 / initial | [390-mock.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-mock.png) | [390-actual.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-actual.png) | [390-side.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-side.png) | [390-overlay.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-overlay.png) | PASS |
| 390×844 / top | [390-mock-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-mock-top.png) | [390-actual-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-actual-top.png) | [390-side-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-side-top.png) | [390-overlay-top.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-overlay-top.png) | PASS |
| 390×844 / middle | [390-mock-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-mock-middle.png) | [390-actual-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-actual-middle.png) | [390-side-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-side-middle.png) | [390-overlay-middle.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-overlay-middle.png) | PASS |
| 390×844 / bottom | [390-mock-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-mock-bottom.png) | [390-actual-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-actual-bottom.png) | [390-side-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-side-bottom.png) | [390-overlay-bottom.png](/Users/amirhasanov/Projects/chat/docs/design/poll-notice/390-overlay-bottom.png) | PASS |

## Проверки

Все команды выполнялись в отдельной Linux Docker-среде `chat-poll-debug`; исходные контейнеры других задач не изменялись.

- Go `go test -race ./internal/polls/...` с `GO_POLLS_TEST_DATABASE_URL` на отдельной тестовой PostgreSQL: domain/application/HTTP/storage PASS, включая два конкурентных голоса и восстановление каждого варианта.
- Go `go vet ./internal/polls/...`, `golangci-lint run ./internal/polls/...`: PASS, 0 issues.
- React suite: 124/124 PASS; после добавления регрессии начальной загрузки отдельно проверены poll notices и shared media.
- React typecheck, lint/architecture, format:check: PASS.
- `script/verify-go-polls` в одноразовой PostgreSQL, с отдельным портом 4074: PASS на 1440 и 390 px. Проверены admin create/close, старое окно без сессии, повторное открытие из активного чата, гостевой голос за второй вариант (201), показ выбора и reload, исчезновение приглашения в другой вкладке, ручное закрытие другого опроса и reload, доступность закрытого приглашения через страницу опросов, новый текст ниже приглашения.
- `verifyMessageScroll` на текущей Docker-сборке: PASS; плавное следование новым сообщениям и сохранение позиции при чтении старых.
- Visual `/chat`: direct navigation, три viewport и три положения длинной ленты плюс initial, см. таблицу.

Полный `script/check` не запускался; commit/push/production не выполнялись. Не проверены Safari/Firefox и конкретный браузер Френчи. Существующая страница `/polls` визуально не перерабатывалась.
