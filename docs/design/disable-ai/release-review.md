# Release design review: APPROVED

2026-10-08. Повторный строгий review `/history` после verifier основного агента на точной release-сборке из worktree `disable-ai-release/chat` (база production 0.24.1). Основной агент подтвердил актуальность Docker PNG и повторное прохождение chat/history/help, refresh, guest/account, summary API 503 и отправки сообщений.

Дизайнер лично открыл все 10 PNG текущего release набора: original mock, actual, side-by-side, overlay и diff для desktop и mobile. Макеты — копии замороженных до реализации эталонов. Fixture одинаковый: гость, пустые фильтры, история не запрошена, clock 2026-10-08T09:00:00Z, locale ru-RU, Europe/Moscow, DPR 1, zoom 100%, scrollY 0. Визуальных расхождений нет; предоставленный compare показывает 0 отличающихся пикселей для обоих размеров, просмотренные diff полностью чёрные.

Все перечисленные артефакты сохранены в `/Users/amirhasanov/.codex/worktrees/disable-ai-release/chat/docs/design/disable-ai/release-current/`.

| Viewport | Артефакты |
| --- | --- |
| 1440×900 | history-desktop-mock.png; history-desktop-actual.png; history-desktop-side-by-side.png (две панели исходного размера); history-desktop-overlay.png; history-desktop-diff.png |
| 390×844 | history-mobile-mock.png; history-mobile-actual.png; history-mobile-side-by-side.png (две панели исходного размера); history-mobile-overlay.png; history-mobile-diff.png |

| Критерий | Desktop 1440×900 | Mobile 390×844 |
| --- | --- | --- |
| Chrome, ссылка назад, заголовок | PASS — совпадают | PASS — совпадают |
| Высоты блоков, первый viewport, отступы | PASS — поиск x288/y452, контент виден | PASS — поиск x16/y688, контент виден |
| Типографика и переносы | PASS — совпадают | PASS — совпадают |
| Фон | PASS — исходный тёмный фон | PASS — исходный тёмный фон |
| Assets: identity/crop/anchor/layering | PASS — декоративных assets нет | PASS — декоративных assets нет |
| Controls и состояние покоя | PASS — Summary отсутствует, фильтры и поиск сохранены | PASS — Summary отсутствует, фильтры и поиск сохранены |
| Горизонтальное переполнение | PASS — отсутствует | PASS — отсутствует |
| Scroll states | PASS — scrollY 0; весь контент помещается, scroll-sensitive слои не менялись | PASS — scrollY 0; весь контент помещается, scroll-sensitive слои не менялись |

Замечаний нет. Визуальная приёмка ограничена зафиксированными состояниями `/history`; функциональность и остальные маршруты покрывает основной verifier. Этот отчёт не утверждает выполнение deployment.
