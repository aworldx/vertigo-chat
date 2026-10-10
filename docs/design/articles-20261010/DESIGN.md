# Article content and illustration refresh — 2026-10-10

Design scope: the public article index and its three existing articles. Preserve the current dark zinc background, amber links, header/navigation/wordmark, Manrope typography, existing max-width containers, spacing rhythm, article callouts and CTA language. Content is the editor-reviewed editorial-draft.md. No invented functionality, decorative photography or generated UI.

## Reference setup

- Routes: /articles, /articles/chats-vs-messengers, /articles/chat-platforms-russia, /articles/how-vertigo-chat-works.
- Viewports: desktop 1440×900, tablet 768×1024, mobile 390×844; device scale 1, browser zoom 1, reduced motion, fresh anonymous context.
- Baseline: baseline/{index|slug}-{width}x{height}.png, captured before changes from local Docker at http://127.0.0.1:4097.
- Proposed reference: mock/{index|slug}-{width}x{height}.png, rendered from proposal/*.tsx via proposal.json over the existing header and stylesheet, before implementation.
- All images use natural proportions. Article images link to the original file and describe this in their captions. Index previews use object-contain so meaningful UI is not cut off. No lightbox or new interaction system.
- Public editorial content is fixed across auth states. Capture is anonymous and uses the same local fonts, image assets and fixture data for mock/current.

## Illustration provenance

- /images/article-vertigo-room.png: actual local Docker interface, 1440×900, 10 October 2026. Isolated demonstration users Лиза/Илья, twelve deliberately authored book-discussion messages; not a production conversation. Header, message log, online list and composer are unmodified browser output.
- /images/article-vertigo-history.png: actual local Docker history, browser screenshot clip 896×646 covering title, date fields, full-nick author/recipient filters and matching public address. Same demonstration participants; no production data. Captured via capture-history.mjs with Russian locale and Moscow timezone.
- External archive provenance and natural dimensions are recorded in ASSETS.md when the original is received and opened.

## Acceptance — each of the twelve route/viewport combinations

PASS only if: original global chrome preserved; headings and first content block visible with matching wrapping; exact local font family/weight/size/line-height; matching container widths, margins, padding and block heights; zinc/amber colours preserved; exact screenshot identity and uncropped natural ratio; captions and original-image links visible and keyboard accessible; table-of-contents anchors target existing headings; no horizontal overflow. No fixed/sticky/animated layer introduced.

Final acceptance requires the main agent's verifier browser run against the implemented Docker build, current full-page PNGs, identical-size side-by-side and pixel-diff artifacts, and the designer personally viewing each original/current/comparison. Any missing artifact or mismatching fixture/dimensions is REJECTED. Final acceptance is separate from the preimplementation mock handoff.
