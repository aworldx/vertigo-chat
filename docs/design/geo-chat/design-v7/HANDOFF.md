# Game panel v7 — frozen preimplementation reference

Supersedes v6 after user screenshot showed excessive header/footer height. Scope: game panel, collapse control and player coexistence; preserve global navigation, chat, themes and assets.

Route `/chat`, guest, browser zoom 100%, device scale 1, theme vertigo_glass. Exact fixtures and 102 PNG paths in `vertigo_glass/artifacts.json`; absolute base `/Users/amirhasanov/Projects/chat/docs/design/geo-chat/design-v7`. Viewports: 1440×900, 1280×678, 1024×678, 768×1024, 390×844, 844×390, 390×544, 320×740. Mock imagery: `docs/design/geo-chat/reference-v1/assets/location.jpg`; existing app theme assets/fonts unchanged. Explicit panorama SDK fixture is not real Google verification.

Acceptance at every viewport and captured top/viewport/bottom scroll: preserve chrome, backgrounds, fonts and asset crop; match compact header, tabs, scene and answer footer; no horizontal overflow; retain input labels and distinct collapse/expand/close controls. Collapse restores peers; open game hides peers even with playing media, without remounting/stopping media. Expanded player uses bottom-right popup without reserving a column. Review requires original PNG, current Docker PNG, side-by-side and overlay/diff with identical fixtures.

## Reference capture repair
Original PNGs are retained unchanged. Seven state groups (21 scroll rows) have a `stable-reference` capture produced from the original committed 48e2241 frontend build, with the same preimplementation proposal.css and DOM transform. Only a 350ms post-scroll rendering wait was added. This restores virtualized chat rows omitted during immediate initial capture; no design specification was changed to match the implementation. Comparison selects these explicit reference paths.
