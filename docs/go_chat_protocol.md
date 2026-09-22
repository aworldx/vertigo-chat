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
connection ID, the latest 30 messages and active/reconnecting peers.

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
