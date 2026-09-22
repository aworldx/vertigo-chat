# Инвентаризация оставшейся миграции

Обновлено: 2026-09-22. Этот документ задаёт порядок последующих срезов в
`codex/go-react-migration`; он не разрешает production rollout.

| Сценарий | Текущее исполнение | Зависимости и границы | Порядок переноса |
| --- | --- | --- | --- |
| Ранги и справка (`/ranks`, `/help`) | `RanksLive`, `Chat.Ranks` | Статические правила рангов; нет записи, сессии, БД или realtime | Следующий React read-only срез; Phoenix остаётся источником данных до отдельного Go-контракта |
| Визиты (`/visits`) | `VisitsLive`, `Chat.Visits` | Активные визиты, сессии чата, PubSub и учёт времени | После realtime/session протокола; не переносить отдельно от lifecycle |
| Библиотека (`/library`) | `LibraryLive`, `Chat.Library` | Статьи, авторизация, ownership, rank-gate, дневные квоты, URL-параметры | Сначала OpenAPI и read-модель, затем React, затем единый Go writer с транзакциями и квотами |
| Галерея (`/gallery`) | `GalleryLive`, `Chat.Gallery` | Фото/thumbnail, S3, likes, caption ownership, rank-gate, дневные и общие квоты, PubSub | После библиотеки или отдельным контекстом только с контрактом медиа, writer ownership и планом rollback |
| Музыкальный чарт | `MusicChartLive`, `Chat.MusicChart` | Upload, likes/comments, listening/visits, music proxy и realtime | После выделения media и realtime контрактов |
| Игры и шашки | `GamesLive`, `CheckersLive` | Авторизация, PubSub, конкурентные действия, порядок событий | Только в отдельном realtime-этапе |
| Чат и landing | `RoomLive`, `LandingLive`, `Chat.*` | Сессии, presence, сообщения, команды, модерация, медиа, bot-интеграции | Последний крупный этап после спецификации realtime и session lifecycle |
| Account/admin/forum | LiveView и контроллеры Phoenix | Сессия, учётные данные, SSO, модерация, эксплуатационные права | После Accounts/Auth bounded context; не смешивать с переносом публичных экранов |

## Ближайший срез: ранги

1. Зафиксировать публичный read-контракт рангов и его ошибки.
2. Реализовать React-экран в `apps/web` со строгим TypeScript, сохранив
   `/ranks/live` и `/help/live` как временный LiveView fallback.
3. Проверить старую и новую версии на трёх viewport, deep link, keyboard/focus
   и отсутствующий горизонтальный overflow.
4. Только после принятия UI решать, оправдан ли Go read-adapter: статические
   правила не требуют искусственного сервиса сами по себе.

Библиотека и галерея остаются следующими кандидатами, но каждую начинать с
описания владельца записи, миграций, авторизации, квот, транзакций и отката.
