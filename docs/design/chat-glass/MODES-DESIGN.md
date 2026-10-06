# Glass: composition and message frame modes

Previous acceptance is revoked by the user's 12:48 screenshot: the header obscured the figure. Revision scope: background anchor and framing, no global navigation/product redesign.

Frozen before implementation: MODES-FROZEN.sha256. Original PNGs: /Users/amirhasanov/Projects/chat/docs/design/chat-glass/mock-modes-{framed,plain}/{width}-{state}.png.
Route /chat, guest glass-designer, Chromium zoom 100%, DPR 1, reduced motion. Fixture in capture-modes.mjs: six messages, one system event, three peers, one poll notice, identical clock/locale/auth for actual captures.
Viewports: 1440×900, 768×1024, 390×844, 844×390, 320×568. States: top, viewport scroll, bottom, commands, settings. Panels use internal scrolling; page itself stays in viewport.

Assets: /images/vertigo-glass-evening-v2.png, /images/karmik-black-concept-v1.png; existing bundled fonts unchanged. Background bottom-right, height minus 240px desktop/tablet, minus 120px mobile, minus 72px short landscape; top and left gradient masks blend edges. Figure face is below desktop participant list, no longer behind global navigation. Cat bottom-aligned within existing sprite box; sidebar remains hidden below 768px, cat below 1024px as before.

Acceptance (each viewport and each mode): PASS only if baseline chrome/type/grid preserved; first content visible; no horizontal overflow; original image identity/scale/anchor/mask retained; black cat retains identity and interactive states; cards have 12px radius, subtle border, dark readable surface with no shared panel; plain mode retains shared pane; system rows stay unframed; menus/settings usable. Scroll must not turn decoration into independent content or cover controls. Compare frozen PNGs, Docker actual PNGs and same-size overlay/diff plus side-by-side before acceptance.
