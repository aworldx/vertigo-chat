# Чёрный Кармик — вариант для стеклянной темы

Макет, не реализация. По запросу пользователя рыжий пиксельный кот заменён стройным чёрным котом. Положение и размер существующего элемента сохранены; тёплая окантовка делает тёмный силуэт видимым. Анимации нового кота пока не подготовлены. Mobile сохраняет существующее отсутствие боковой панели, новый кот туда не добавлен.

Route `/chat`, Docker Chromium, DPR 1, zoom 100%, ru-RU, Europe/Moscow; guest glass-designer; fixture и CSS предыдущего reading-first варианта. PNG: `1440-top.png` 1440×900 и `390-top.png` 390×844. Absolute root `/Users/amirhasanov/Projects/chat/docs/design/chat-glass/mock-black-cat/`. Render: `../capture-black-cat.mjs`; local override `../proposal-black-cat.css`. Остальные ресурсы и состояние перечислены в `../mock-reading/README.md`.

Generated asset: `/Users/amirhasanov/Projects/chat/apps/web/public/images/karmik-black-concept-v1.png`; built-in image_gen, transparent_background=true. PNG содержит alpha. Новый образ пока используется только в этом макете.

Final generation prompt:

Use case: stylized-concept. Asset type: transparent-background cat mascot illustration for an elegant dark noir chat UI. A single slender adult black domestic short-haired cat resting in a relaxed low sphinx pose, its long slim body extending to the right, long graceful tail curling alongside the front paws. The cat has a small refined feline head, long ears, subtle cheekbones, natural cat anatomy, gently half-open warm amber eyes, calm friendly expression. Sophisticated hand-painted digital illustration with fine fur detail and softly defined shapes, not pixel art, not a chunky cartoon, not a photograph. Black charcoal fur with restrained warm amber rim lighting across ears, back and paws, so the silhouette reads on a dark green-black interface. Three-quarter front view, entire cat and tail visible, centered, generous transparent margins. No floor, no setting, no props, no collar, no yarn, no text, no logo. True transparent background.
