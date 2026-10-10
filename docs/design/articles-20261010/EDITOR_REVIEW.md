# Independent editorial review — 10 October 2026

Status: **APPROVED — final editorial review, revision 2**.

Reviewed exact ArticlesIndex.tsx, ChatsArticle.tsx, HistoryArticle.tsx, TechnologyArticle.tsx and render-articles.tsx against editorial-draft.md. No UI files edited by reviewer.

## Resolved correction

ChatsArticle says `/музыка` opens search. `apps/web/src/features/chat/model/useRoomCommands.ts:50–54` rejects an empty argument with «Добавь поисковый запрос после команды». Corrected to the repeatable example `/музыка Кино` in implementation, editorial draft and revision2 mock. Reviewer re-read exact JSX and opened corrected desktop/mobile current PNGs. Main verifier additionally reports a real guest command invocation with q=Кино, a private fixture result and no public music message. This error originated in the editorial draft and is now resolved.

## Facts and completeness already verified

- Comparison article acknowledges Telegram public groups, replies, mentions and moderation; compares actual communication scenarios, not a caricature of competing platforms. Official source: https://telegram.org/tour/groups.
- History retains IRC, Krovatka, August4u, Borodin, ICQ/Agent, social networks, Telegram and Vertigo. Scope is stated once in the lead. References are adjacent to claims. RFC1459 publication May1993 verified: https://www.rfc-editor.org/rfc/rfc1459.html.
- Krovatka testimony attributed to Andrey Kulya; surviving excerpt checked at https://daily.afisha.ru/culture/2550-interesnye-stati/. No unsupported founding date or audience records remain. Original Secretmag interview URL is404 and is not linked as available evidence.
- August4u names, restored designs and 2006 server event checked against owners’ https://www.secret4u.ru/des.htm. Borodin attribution and publication date27.09.2010 checked at operator’s https://nik-chat.net/main/6-skachat-besplatno-chat-borodina.html; current Telegram invitation also present there. Promotional reliability/security claims are not repeated.
- ICQ1996, Agent2003 and social-network photos/status functionality verified in Mail.Ru Group2010 annual report printedpp12–13: https://corp.vkcdn.ru/media/files/mail.rugroupar2010.pdf. Current ICQ closure notice checked at https://icq.com/desktop/en. No unavailable ICQ screenshot referenced.
- Technology correctly distinguishes initial100 messages from three-calendar-month archive; Moscow time, inclusive lastminute,100-result paging, author/recipient exactnickname filters checked against rooms/application/history.go, rooms/adapters/postgres/history.go and shared/chatHelp.ts.
- Online private: active recipient, no room-history DB insert, RAM dedup cache; checked chatsessions/adapters/http/private.go and hub.go. No offline delivery or E2EE promised. Notes persist in offline_notes; bot conversations persist in bot_messages and context is passed to AI provider. Checked notes/adapters/postgres/store.go and bot/adapters/postgres/store.go.
- PBKDF2 SHA256,16-byte salt,210000 iterations,32-byte result and constant-time comparison checked accounts/adapters/postgres/accounts.go. Unverified global logging-redaction assertion removed.
- Titles, leads, index descriptions, metadata and update dates agree semantically. Existing renderer’s brand suffix differs cosmetically from draft and is acceptable. All table-of-contents hrefs have matching section IDs in JSX.

## Images personally opened

Original assets opened through view_image: article-vertigo-room.png1440×900, article-vertigo-history.png896×646, /tmp/articles-august-nightcats.jpg400×226. Room has12 demonstration Lizа/Ilya messages, member list and composer. History has Moscow range, Ilya→Liza filters and one matching public addressed message. Captions identify demonstration data.

NightCats filename confirmed by original owners’ HTML /tmp/articles-secret4u-vps.html: lines222–227 label NightCats and «Разработка2011года» followed by images/NightCats-chat-avgusta.jpg. Caption assigns2011 to design, not capture date. Actual400×226 dimensions used rather than incorrect HTML400×217. Both article and index preserve full image and cap enlargement. Image is correctly identified as August4u, not Krovatka.

Mock PNGs personally inspected:
- index-1440x900.png
- index-390x844.png
- chat-platforms-russia-1440x900-figure-1.png
- chat-platforms-russia-390x844-figure-1.png
- chats-vs-messengers-768x1024-figure-1.png
- how-vertigo-chat-works-390x844-figure-1.png

Captions remain readable and identify subjects accurately. Small mobile UI details can be opened at original size via the image link. Old VK login and Telegram2017 theme screenshot no longer appear in JSX.

Main verifier and strict designer review remain separate release requirements; this editorial review does not substitute for them. No unresolved editorial blockers remain.


## Per-article completeness assessment

### Общая комната или мессенджер

**Complete for its stated practical comparison.** Answers who the recipient is, whether a response is expected now or later, how to join a Vertigo conversation, what is public versus private, how to leave an offline note, how to return to previous discussion, and when another format is more appropriate. Telegram groups are expressly acknowledged; this is not an artificial claim that messengers lack communities. The repeatable music example and real room screenshot make the advice concrete. Deliberately outside scope: a complete market comparison, all Telegram features, a catalog of every Vertigo game, and claims about relative audience size or superior safety. None is promised by title or lead.

### От «Кроватки» и ICQ до Telegram

**Complete as the explicitly selective history promised in the lead.** Covers protocol foundations(IRC), an identifiable Russian community(Krovatka), hosted chat customization(August4u), reusable engine versus individual community(Borodin/Nikchat), personal messenger contacts(ICQ/Agent), profile/photo/status context in social networks, and group features in Telegram. Explains coexistence rather than a simplistic replacement sequence; gives documented dates1993/1996/2003/2006/2010/2011/2016 in appropriate contexts and clearly attributes testimony. The archived NightCats interface is a concrete visual example, correctly labeled as August4u rather than Krovatka or ICQ. Deliberately outside scope: an exhaustive chronology of every Russian network/client, disputed exact Krovatka launch date, audience rankings, and a universal explanation of community migration. This limitation is explicit, not an accidental omission.

### Что Vertigo сохраняет

**Complete for a reader choosing among public messages, online private messages and offline notes.** Covers transport, initial100-message context, archive duration/timezone/filter semantics/paging, active-recipient requirement, absence of durable private history plus ephemeral memory, screenshot/copy limits and noE2EE promise, persistent notes, separate bot storage/AI context, password hashing parameters, and concrete decision guidance. The current history screenshot visibly supports both filter names and their result. Deliberately outside scope: an infrastructure/security audit, exhaustive retention policies for every data type or provider, implementation of all chat features, and promises of anonymous or untraceable communication. The article does not suggest it provides those guarantees.

## Current implementation images additionally inspected

Personally opened from current/: how-vertigo-chat-works-1440x900-top.png; how-vertigo-chat-works-768x1024-figure-1.png; chat-platforms-russia-768x1024-top.png; chat-platforms-russia-1440x900-figure-2.png; index-768x1024.png; chat-platforms-russia-390x844-figure-1.png. After correction, also opened chats-vs-messengers-1440x900.png and chats-vs-messengers-390x844.png. Exact JSX confirms corrected command, while these full-page captures confirm article composition and no missing content blocks. Full-page previews may be downscaled by viewer; detailed picture claims were checked in separately opened source assets and figurePNG files.

**Final judgment:** texts are more specific, cover their declared subjects, and no longer make the obsolete history/privacy assertions found in the initial audit. All three replacement illustrations are relevant real interface images with truthful provenance and captions. APPROVED for editorial content and image correspondence.
