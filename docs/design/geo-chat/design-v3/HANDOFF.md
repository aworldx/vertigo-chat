# Geo design v3 — 6 October 2026

Prepared before implementation of the user-requested spacing correction.
Route /chat, Docker chat-nice-work at 4092, DPR 1, zoom 100%, ru-RU,
Europe/Moscow. Frozen v1 assets and v2 representative messages/auth fixture.
The original v1/v2 references remain unchanged.

Change: standard themes receive 16px desktop / 12px tablet / 10px phone panel
margins. Glass/Nice retain their existing outer shell spacing. Expanded mode:
24px desktop/tablet, 12px phone/landscape. Caption moves to top so Google logo
and copyright remain visible at the bottom of real imagery. No navigation,
chat typography or background changes. Same viewport/state list as v2.

Acceptance: compare original mock, current Docker capture, side and overlay at
identical viewport, theme and fixture; no overflow, photo attribution visible,
first chat content/composer accessible, correct spacing at top/middle/bottom.
Google map imagery differs from illustrative OSM reference; map review remains
pending a concrete provider-specific design and real browser validation.
