# Public Go chat protocol (local migration)

`POST /api/v1/chat/enter` accepts `{nickname,password}`; an empty password
requests guest entrance. `POST /api/v1/chat/register` accepts
`{nickname,password,email}`. Both require the account session's CSRF token and
same-origin request. Account creation, registration guard, account-cookie
rotation, visit, chat-session and join message commit together. Failure rolls
back the whole entrance. No new chat tables are introduced.

The result contains `data: {resume_token,nickname}`. The opaque credential is
saved in the current tab's sessionStorage, never a URL/cookie/localStorage.
It contains a random secret verified against the existing durable hash.
Site logout does not revoke a chat session or clear its outbox.

`GET /api/v1/chat/socket` upgrades only from the configured origin. Within five
seconds, the client sends `{type:"resume",resume_token}`. Successful restoration
increments the durable generation, fencing commands and disconnects from old
connections. The server sends `ready` with session ID, nickname, generation,
connection ID, the latest 100 messages and active/reconnecting peers.

Commands: `{type:"heartbeat",visibility:"visible"|"hidden"}`,
`{type:"send",client_id,body}`, `{type:"leave"}`. Server replies include
`ack` with the durable message, `snapshot` with the current bounded room window
and peers, `left`, or `error` with a stable code. The server-issued connection
ID describes this transport; it is not a credential or chosen by the client.
Snapshots replace the server window explicitly, avoiding cursor gaps after
retention, restart or disconnection. Client outbox IDs are preserved across
retry and uniquely scoped to room + author identity.

WebSocket ping/pong drives liveness. The server renews the existing session on
confirmed transport activity and marks transport loss reconnecting; the durable
reaper handles expiry. Sending a message and checking the current generation
share a database transaction. Message publication follows commit. The local
transport refreshes the bounded DB projection, so reaper changes and writes
from another Go process are visible without using process memory as authority.

Explicit leave clears the tab credential/outbox before requesting termination.
Resume after a terminal server response clears stale credentials; network errors
retain them for retry. Guest and registered nickname reservations use the same
transaction lock as account registration.

Message presentation (2026-09-22): every `Message` in `ready`, `snapshot` and
`ack` includes normalized `appearance.dark/light.{nickname_color,text_color}`,
`font_id` (`theme|sans|display|serif`) and `font_style` (`normal|italic`). These
are read from the existing `room_messages` columns; malformed legacy values
fall back to the existing Phoenix defaults. Domain values are mapped to explicit
wire DTOs. New sends snapshot the author’s saved appearance and font preferences.
The viewer's frame preference is separate and is not a message attribute.
`sent_at` is an instant; writes to legacy timestamp-without-time-zone columns
use UTC explicitly, independently of the PostgreSQL session timezone.

The React feed renders confirmed IDs without replacing surviving DOM nodes.
Resize/mutation observers follow the bottom only while the reader is there;
reading older messages survives snapshots and new sends. Failed outbox entries
can be retried with the same client ID or explicitly removed from tab storage.

Presence presentation (2026-09-22): each Peer includes `registered` (the
authenticated account identity of the durable chat session) and `self` (session
ID matches the viewer). Identity keys and user IDs are never exposed. Peers
include active and reconnecting sessions, in nickname order; ended sessions
are absent. React shows presence labels only for reconnecting participants or busy bots. During local
transport loss only the viewer's row shows reconnecting immediately; other
rows retain their last server snapshot until reconnection. Public/private addressing, registered appearance/ranks, profile actions and bot
activity are included. Peers expose listening title and bot busy state.

Room settings: snapshots include viewer `preferences` and `admin`; peers include
public preferences and rank. `{type:"preferences",preferences}` is a fenced
mutation, answered with `{type:"preferences",preferences}` only after commit.
Accounts owns registered preferences; Chatlans owns guest preferences. New
messages copy normalized current preferences at send time; retries retain the
original durable appearance. No Phoenix writes or proxy are involved.

## Расширение комнаты (локальный этап 2026-09-22)

- Snapshot содержит `preferences`, `admin`, `typing`; peer — `bot`, `rank`,
  `preferences`. Message содержит `recipient`, aggregate `reactions` и viewer-only
  `reacted` (идентификаторы голосовавших не выдаются), media metadata.
- `preferences {preferences}` возвращает одноимённый ответ после fenced transaction.
- `reaction {message_id,emoji,active}` задаёт состояние идемпотентно. Автор не
  реагирует на собственное сообщение; разрешены шесть серверных emoji.
- `delete {message_id}` требует registered admin; системные записи не удаляются.
- `send` с префиксом `^nickname, body` проходит отдельную private ветку. Ошибка
  никогда не превращает private текст в публичный. ACK и адресный `private`
  frame используют отрицательный временный ID. Reload удаляет private feed.
- `typing {active}` проверяет generation; индикатор истекает через пять секунд.
- `media {client_id,media}` принимает только разрешённые provider URL и сохраняет
  существующие `media_*` поля Rooms. Поиск — authenticated HTTP по контракту.
- `signal {target,body}` передаёт SDP offer/answer только между активными
  участниками одной комнаты. Offer разрешён зарегистрированному участнику;
  sender берётся из server session, не из клиентского payload. Bytes файлов
  передаются отдельно по WebRTC, в PostgreSQL их нет.
- `/chat/upgrade` аутентифицирует resume-secret и generation внутри транзакции,
  сохраняет visit и preferences, ротирует identity/secret/account cookie.

Hub private/signaling пока локален одному API-процессу. Multi-instance routing,
устойчивая private дедупликация после restart и нагрузочная проверка остаются
отдельными условиями production cutover.

Responses adapter следует [официальной документации генерации текста](https://developers.openai.com/api/docs/guides/text):
чтение вложенных `output[].content[]`, явные instructions, `store:false` и
хешированный safety identifier. Живой запрос на пользовательском ключе при этой
миграции не выполнялся.


## Доставка, listening и файлы

ACK подтверждает приём, snapshot — появление в опубликованной истории:
`sending` (одна серая) → `confirmed` (две серых) → published (две голубых).
При quota error outbox становится `blocked`; reload не повторяет blocked,
confirmed или failed сообщения. Private остаётся ephemeral и sender/recipient only.
`listening {body,active}` меняет название трека у текущего fenced peer;
`bot_busy` отражает общий token budget и provider Retry-After.

File signals: `announce`, `request`, `offer`, `answer`, `relay_request`,
`relay_chunk {index,total,data}`, `relay_ack {index}`. Announce доступен только
registered, owner определяется session. Registry проверяет room/owner/requester,
TTL 15 минут, длину/порядок блоков и дубли. Новый request сбрасывает принятые
индексы для повторной передачи. Клиент ждёт ACK перед следующим блоком;
relay chunk максимум 18000 bytes/24000 base64 characters. Изображения до 5 MB,
аудио до 50 MB, MIME сверяется с сигнатурой. MSE queue начинает MP3 playback
до завершения файла; неподдерживаемый формат собирается в Blob по окончании.

Поиск медиа использует authenticated HTTP и ограниченную очередь сервера,
список прокси читается только сервером. Хит-парад использует отдельные Go HTTP
контракты с account-cookie/CSRF, owner checks и существующими таблицами.

## Личные подсказки Кармика (2026-09-26)

`ack` принятого публичного текстового сообщения может содержать `help_topics`
(массив ключей из перечисления `HelpTopic` в `contracts/openapi/chat.yaml`). Поле отправляется только
в соединение автора; в `Message`, `snapshot`, БД общей истории и broadcast его нет.
Повтор с тем же `client_id` возвращает тот же ID сообщения; React хранит одну
карточку на ID, ограничивает память последними 100 подсказками и не использует
localStorage. Карточка появляется под вопросом, свёрнута по умолчанию, с кнопкой
раскрытия проверенных инструкций. После перезагрузки уже подтверждённые подсказки
не восстанавливаются. Личные сообщения, медиа и отклонённые отправки их не создают.
Локальный распознаватель явных вопросов о функциях чата работает для гостей и
аккаунтов сразу, независимо от трёхминутной оценки кармы, её квот и OpenAI.
