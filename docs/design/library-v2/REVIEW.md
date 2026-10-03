# Дизайн-ревью библиотеки v2

Дата: 3 октября 2026. Итог: **ПРИНЯТО для зафиксированной версии v2**.

Предыдущие варианты с огромным заголовком, старым фоном с мужчиной и прямоугольной
вставкой лампы не приняты и не являются эталоном. В этом проходе сначала сохранены
независимые макеты, затем изменена реализация, затем выполнены Docker-проверки и
просмотр макетов/реальных кадров бок о бок и в наложении.

## Область и доказательства

- Одна и та же авторизация `fixture01`, три статьи и серия из контракта README,
  одинаковые даты, Chromium, scale 1 и viewport. Список и пустой новый редактор.
- Просмотрены top, одна высота viewport с ограничением по нижней границе, bottom.
  Если страница короче двух экранов, viewport и bottom совпадают — это не пропуск
  состояния. Фон неподвижен, не перекрывает содержимое; шапка не дублируется.
- Таблица содержит оригинал, настоящий снимок, side-by-side и overlay; diff также
  сохранён рядом. На сравнениях слева макет, справа реальный интерфейс.
- **Список:** RGB-пиксели совпадают полностью на всех 12 кадрах (mean error 0).
- **Редактор:** до 3 пикселей на кадр отличаются по каналу более чем на 12/255;
  максимум 0.000382%, средняя ошибка менее 0.077/255. При просмотре нет сдвига
  геометрии, шрифтов, элементов или изображений; различия относятся к растеризации.
- Это соответствие воспроизводимым PNG v2, не заявление о пиксельном совпадении
  с AI-картинкой-направлением, содержащей выдуманные меню/счётчики.

Проверки в каждой строке: **C** — общие панели; **H** — высоты и первый экран;
**T** — шрифты; **B** — фон; **L** — идентичность/crop/позиция/слой лампы;
**U** — кнопки и поля; **O** — отсутствие overflow; **S** — состояние прокрутки.
PASS в таблице означает, что все восемь пунктов просмотрены и выполнены.
В редакторе общие панели закрыты диалогом намеренно, как на исходном макете.

| Экран | Viewport / состояние | C/H/T/B/L/U/O/S | Оригинал | Реальный UI | Сравнение | Наложение |
|---|---|---|---|---|---|---|
| Список | 1440×900 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1440-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1440-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-top-overlay.png) |
| Список | 1440×900 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1440-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1440-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-viewport-overlay.png) |
| Список | 1440×900 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1440-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1440-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1440-bottom-overlay.png) |
| Список | 1280×676 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1280-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1280-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-top-overlay.png) |
| Список | 1280×676 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1280-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1280-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-viewport-overlay.png) |
| Список | 1280×676 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/1280-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-1280-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/1280-bottom-overlay.png) |
| Список | 768×1024 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/768-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-768-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-top-overlay.png) |
| Список | 768×1024 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/768-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-768-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-viewport-overlay.png) |
| Список | 768×1024 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/768-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-768-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/768-bottom-overlay.png) |
| Список | 390×844 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/390-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-390-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-top-overlay.png) |
| Список | 390×844 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/390-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-390-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-viewport-overlay.png) |
| Список | 390×844 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock/390-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-list-390-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/comparison/390-bottom-overlay.png) |
| Редактор | 1440×900 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1440-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1440-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-top-overlay.png) |
| Редактор | 1440×900 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1440-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1440-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-viewport-overlay.png) |
| Редактор | 1440×900 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1440-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1440-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1440-bottom-overlay.png) |
| Редактор | 1280×676 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1280-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1280-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-top-overlay.png) |
| Редактор | 1280×676 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1280-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1280-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-viewport-overlay.png) |
| Редактор | 1280×676 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/1280-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-1280-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/1280-bottom-overlay.png) |
| Редактор | 768×1024 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/768-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-768-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-top-overlay.png) |
| Редактор | 768×1024 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/768-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-768-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-viewport-overlay.png) |
| Редактор | 768×1024 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/768-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-768-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/768-bottom-overlay.png) |
| Редактор | 390×844 / top | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/390-top.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-390-top.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-top-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-top-overlay.png) |
| Редактор | 390×844 / viewport | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/390-viewport.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-390-viewport.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-viewport-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-viewport-overlay.png) |
| Редактор | 390×844 / bottom | PASS | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/mock-editor/390-bottom.png) | [PNG](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/community/library-editor-390-bottom.png) | [Бок о бок](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-bottom-side-by-side.png) | [Overlay](/Users/amirhasanov/Projects/chat/docs/design/library-v2/review/library-review/editor-comparison/390-bottom-overlay.png) |

## Позиции и композиция по отрисованным кадрам

- 1440: компактный заголовок под сохранёнными панелями, первая карточка около y336;
  серии справа, лампа в правом свободном поле около y500–665. При прокрутке карточки
  движутся, лампа остаётся частью комнаты, не становится отдельным экраном.
- 1280: первая карточка около y336, лампа около y380–530; при нижней прокрутке
  три карточки доступны, нет пустого блока перед ними или перекрытия.
- 768: первая карточка около y358, серии справа; лампа около y570–760, вне текста.
- 390: заголовок около y230, лампа около y280–385, панель серий около y415;
  первая карточка около y594. После прокрутки текст остаётся читаемым поверх
  полупрозрачных поверхностей; фон не перехватывает касания.
- Редактор: на 1440 форма целиком входит по высоте; на 1280 нижние действия доступны
  прокруткой. На 768/390 работает закреплённая нижняя панель; mobile поля серии и
  номера выровнены, нижние подсказки доступны при прокрутке. Лампа остаётся на общем
  фоне за диалогом, а не вставкой в область предпросмотра.

## Verifier

В Docker успешно выполнены typecheck, lint/проверка архитектурных границ,
122 frontend unit-теста, Go domain/HTTP-тесты библиотеки и
`script/verify-target-web` с настоящими Go API и изолированными PostgreSQL-базами.

Пройденные сценарии: прямой переход/reload; пустая библиотека; серии и порядок
частей; раскрытие/сворачивание; создание и изменение; сохранение форматирования
после reload; безопасные ссылки и отказ javascript URL; очистка/undo/redo;
пустой и слишком большой текст; mobile вкладки; подтверждение потери правок;
кнопки touch target ≥44px. Отдельно открыт реальный локальный `/library` после
обновления стенда: текущая статья пользователя, фон и лампа отображаются.

Обязательный visual gate интегрирован в `script/verify-target-web`.
Self-test: одинаковые картинки проходят, изменённый участок и чужой viewport
отвергаются. Никакой авто-перезаписи эталонов нет. Захват макетов заблокирован
при наличии `FROZEN.sha256`; изменение дизайна требует новой версии.
Полный `script/check` в этом проходе не запускался: push/merge/production не выполнялись.

## Ограничения

Обложки — три заранее сгенерированных декоративных изображения, а не AI-генерация
по тексту по нажатию кнопки. Такой сервис и новые продуктовые возможности не
добавлялись. Данные и права реального пользователя не заменялись тестовыми.
