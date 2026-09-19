// Назначение файла: клиентская точка входа Phoenix, подключает LiveView, WebSocket и UI hooks.
// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//
// If you have dependencies that try to import CSS, esbuild will generate a separate `app.css` file.
// To load it, simply add a second `<link>` to your `root.html.heex` file.

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import {hooks as colocatedHooks} from "phoenix-colocated/chat"
import MediaSharing from "./media_sharing"
import "./theme"

const Uploaders = {
  S3(entries, onViewError) {
    entries.forEach(entry => {
      const xhr = new XMLHttpRequest()
      onViewError(() => xhr.abort())
      xhr.open("PUT", entry.meta.url, true)
      xhr.setRequestHeader("content-type", entry.meta.content_type)
      xhr.upload.addEventListener("progress", event => entry.progress(event.loaded / event.total * 100))
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? entry.progress(100) : entry.error()
      xhr.onerror = () => entry.error()
      xhr.send(entry.file)
    })
  },
}

const CHAT_PREFERENCES_KEY = "chat:guest-preferences"
const USER_AUTH_KEY = "chat:user-auth"
const USER_SESSION_KEY = "chat:user-session"
const GUEST_SESSION_KEY = "chat:guest-session"
const GUEST_SESSION_TOKEN_KEY = "chat:guest-session-token"
const GUEST_NICKNAME_KEY = "chat:guest-nickname"
const GUEST_IDENTITY_TOKEN_KEY = "chat:guest-identity-token"
const MESSAGE_DRAFT_KEY = "chat:message-draft"
const MESSAGE_CURSOR_KEY = "chat:message-cursor"
const MESSAGE_HYDRATED_AT_KEY = "chat:message-hydrated-at"
const MESSAGE_OUTBOX_KEY = "chat:message-outbox"
const MESSAGE_OUTBOX_CHANGED_EVENT = "chat:message-outbox-changed"
const MESSAGE_OUTBOX_RETRY_EVENT = "chat:message-outbox-retry"
const LONG_POLL_FALLBACK_KEY = "phx:fallback:LongPoll"
const LONG_POLL_FALLBACK_MS = 8_000
const MESSAGE_REHYDRATION_COOLDOWN_MS = 15_000
const MESSAGE_ACK_TIMEOUT_MS = 10_000
const MESSAGE_OUTBOX_LIMIT = 50
const MESSAGE_SYNC_INTERVAL_MS = 10_000

// Auth is deliberately limited to the current browser tab. Older versions
// stored this token in localStorage, so discard that persistent copy once.
localStorage.removeItem(USER_AUTH_KEY)

const readChatPreferenceStore = () => {
  const fallback = {current_nickname: null, by_nickname: {}}
  const storedPreferences = localStorage.getItem(CHAT_PREFERENCES_KEY)

  if (!storedPreferences) {
    return fallback
  }

  try {
    const parsed = JSON.parse(storedPreferences)

    if (parsed.by_nickname) {
      return {...fallback, ...parsed, by_nickname: parsed.by_nickname || {}}
    }
  } catch (_error) {
    localStorage.removeItem(CHAT_PREFERENCES_KEY)
  }

  return fallback
}

const writeChatPreferenceStore = store => {
  localStorage.setItem(CHAT_PREFERENCES_KEY, JSON.stringify(store))
}

const readMessageOutbox = () => {
  try {
    const entries = JSON.parse(sessionStorage.getItem(MESSAGE_OUTBOX_KEY) || "[]")

    if (!Array.isArray(entries)) throw new Error("invalid message outbox")

    return entries.filter(entry =>
      entry &&
      typeof entry.clientId === "string" &&
      entry.clientId.length > 0 &&
      entry.clientId.length <= 64 &&
      typeof entry.body === "string" &&
      entry.body.trim().length > 0 &&
      entry.body.length <= 1_000,
    )
  } catch (_error) {
    sessionStorage.removeItem(MESSAGE_OUTBOX_KEY)
    return []
  }
}

const writeMessageOutbox = entries => {
  const boundedEntries = entries.slice(-MESSAGE_OUTBOX_LIMIT)

  if (boundedEntries.length > 0) {
    sessionStorage.setItem(MESSAGE_OUTBOX_KEY, JSON.stringify(boundedEntries))
  } else {
    sessionStorage.removeItem(MESSAGE_OUTBOX_KEY)
  }

  window.dispatchEvent(
    new CustomEvent(MESSAGE_OUTBOX_CHANGED_EVENT, {detail: {entries: boundedEntries}}),
  )
}

const updateMessageOutboxEntry = (clientId, changes) => {
  writeMessageOutbox(
    readMessageOutbox().map(entry =>
      entry.clientId === clientId ? {...entry, ...changes} : entry,
    ),
  )
}

const acknowledgeOutboxMessage = clientId => {
  if (typeof clientId !== "string" || !clientId) return
  writeMessageOutbox(readMessageOutbox().filter(entry => entry.clientId !== clientId))
}

const appearanceFrom = preferences => {
  return preferences.appearance || {}
}

const clearGuestSession = () => {
  const nextStore = readChatPreferenceStore()
  const nickname = nextStore.current_nickname

  if (nickname && nextStore.by_nickname[nickname]) {
    delete nextStore.by_nickname[nickname].identity_token
    writeChatPreferenceStore(nextStore)
  }

  sessionStorage.removeItem(GUEST_SESSION_KEY)
  sessionStorage.removeItem(GUEST_SESSION_TOKEN_KEY)
  sessionStorage.removeItem(GUEST_NICKNAME_KEY)
  sessionStorage.removeItem(GUEST_IDENTITY_TOKEN_KEY)
}

const clearChatSession = () => {
  clearGuestSession()
  sessionStorage.removeItem(USER_AUTH_KEY)
  sessionStorage.removeItem(USER_SESSION_KEY)
  writeMessageOutbox([])
}

// A short outage (for example, waking a laptop) must not permanently force this
// tab into long-poll. Phoenix otherwise remembers its first fallback in session
// storage, even after WebSocket becomes available again.
const liveSocketSessionStorage = {
  getItem(key) {
    return key === LONG_POLL_FALLBACK_KEY ? null : sessionStorage.getItem(key)
  },
  setItem(key, value) {
    if (key !== LONG_POLL_FALLBACK_KEY) sessionStorage.setItem(key, value)
  },
  removeItem(key) {
    sessionStorage.removeItem(key)
  },
}

sessionStorage.removeItem(LONG_POLL_FALLBACK_KEY)

const playMessageNotification = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext

  if (!AudioContext) return

  const context = new AudioContext()
  const startedAt = context.currentTime

  if (context.state === "suspended") context.resume()

  const notes = [880, 1_320]

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const noteAt = startedAt + index * 0.12

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(frequency, noteAt)
    gain.gain.setValueAtTime(0.0001, noteAt)
    gain.gain.exponentialRampToValueAtTime(0.045, noteAt + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteAt + 0.11)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(noteAt)
    oscillator.stop(noteAt + 0.12)
  })

  window.setTimeout(() => context.close(), 350)
}

const chatSessionParams = () => {
  const withMessageCursor = params => {
    const cursor = sessionStorage.getItem(MESSAGE_CURSOR_KEY)

    if (!document.getElementById("messages") || !/^\d+$/.test(cursor || "")) return params

    return {...params, message_cursor: cursor}
  }

  const userAuthToken = sessionStorage.getItem(USER_AUTH_KEY)

  if (userAuthToken) {
    return withMessageCursor({
      user_auth_token: userAuthToken,
      chat_session_token: sessionStorage.getItem(USER_SESSION_KEY),
    })
  }

  const store = readChatPreferenceStore()
  const currentNickname = sessionStorage.getItem(GUEST_NICKNAME_KEY)
  const currentPreferences = (currentNickname && store.by_nickname[currentNickname]) || {}

  if (
    currentNickname &&
    currentPreferences &&
    sessionStorage.getItem(GUEST_SESSION_KEY)
  ) {
    return withMessageCursor({
      guest_nickname: currentNickname,
      guest_session_token: sessionStorage.getItem(GUEST_SESSION_TOKEN_KEY),
      guest_identity_token: sessionStorage.getItem(GUEST_IDENTITY_TOKEN_KEY),
      theme_id: currentPreferences.theme_id,
      appearance: appearanceFrom(currentPreferences),
      font_id: currentPreferences.font_id,
      font_style: currentPreferences.font_style,
      message_sound_enabled: currentPreferences.message_sound_enabled,
    })
  }

  return {}
}

if (Object.keys(chatSessionParams()).length > 0) {
  document.documentElement.dataset.chatSessionRestoring = "true"

  window.setTimeout(() => {
    if (!document.documentElement.dataset.chatSessionRestoring) return

    delete document.documentElement.dataset.chatSessionRestoring
    document.documentElement.dataset.chatSessionRestoreTimedOut = "true"
  }, 12_000)
}

const chatHooks = {
  ChatEntrance: {
    mounted() {
      this.handleEvent("prepare-chat-navigation", async session => {
        try {
          clearChatSession()
          sessionStorage.removeItem(MESSAGE_DRAFT_KEY)
          sessionStorage.removeItem(MESSAGE_CURSOR_KEY)
          sessionStorage.removeItem(MESSAGE_HYDRATED_AT_KEY)

          if (session.user_token) {
            sessionStorage.setItem(USER_AUTH_KEY, session.user_token)
            sessionStorage.setItem(USER_SESSION_KEY, session.session_token)
          } else {
            sessionStorage.setItem(GUEST_NICKNAME_KEY, session.nickname)
            sessionStorage.setItem(GUEST_SESSION_TOKEN_KEY, session.session_token)
            sessionStorage.setItem(GUEST_IDENTITY_TOKEN_KEY, session.identity_token)
            sessionStorage.setItem(GUEST_SESSION_KEY, "true")
          }
        } catch (_error) {
          this.pushEvent("chat_storage_failed", {})
          return
        }

        if (session.account_login_token) {
          try {
            const response = await fetch("/account/chat-login", {
              method: "POST",
              credentials: "same-origin",
              headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
              body: JSON.stringify({token: session.account_login_token}),
            })
            if (!response.ok) throw new Error("Account login failed")
            accountChannel?.postMessage("changed")
          } catch (_error) {
            clearChatSession()
            this.pushEvent("chat_storage_failed", {})
            return
          }
        }
        this.pushEvent("chat_session_saved", {})
      })
    },
  },
  KarmikPet: {
    mounted() {
      this.lastPetAt = 0
      this.lastPurrAt = 0
      this.purrAudio = new Audio("/sounds/karmik-purr.mp3")
      this.purrAudio.preload = "auto"
      this.pet = ({ withSound = false } = {}) => {
        const now = Date.now()

        if (withSound) this.purr(now)
        if (now - this.lastPetAt < 10_000) return

        this.lastPetAt = now
        this.pushEvent("pet_karmik", {})
      }

      this.purr = now => {
        if (now - this.lastPurrAt < 10_000) return

        this.lastPurrAt = now
        window.clearTimeout(this.purrTimer)
        window.clearInterval(this.purrFade)
        this.purrAudio.currentTime = 0
        this.purrAudio.volume = 0.75
        this.purrAudio.play().catch(() => {})
        this.purrTimer = window.setTimeout(() => {
          let stepsLeft = 5

          this.purrFade = window.setInterval(() => {
            stepsLeft -= 1
            this.purrAudio.volume = (0.75 * stepsLeft) / 5

            if (stepsLeft > 0) return

            window.clearInterval(this.purrFade)
            this.purrAudio.pause()
            this.purrAudio.currentTime = 0
          }, 60)
        }, 2_500)
      }

      this.keyboardPet = event => {
        if (event.key !== "Enter" && event.key !== " ") return

        event.preventDefault()
        this.pet({ withSound: true })
      }
      this.cursorPet = () => this.pet()
      this.soundPet = () => this.pet({ withSound: true })

      this.el.addEventListener("pointerenter", this.cursorPet)
      this.el.addEventListener("pointermove", this.cursorPet)
      this.el.addEventListener("pointerdown", this.soundPet)
      this.el.addEventListener("keydown", this.keyboardPet)
    },
    destroyed() {
      window.clearTimeout(this.purrTimer)
      window.clearInterval(this.purrFade)
      this.purrAudio.pause()
      this.el.removeEventListener("pointerenter", this.cursorPet)
      this.el.removeEventListener("pointermove", this.cursorPet)
      this.el.removeEventListener("pointerdown", this.soundPet)
      this.el.removeEventListener("keydown", this.keyboardPet)
    },
  },
  PrivateNickname: {
    mounted() {
      this.onClick = () => {
        window.clearTimeout(this.clickTimer)
        this.clickTimer = window.setTimeout(() => {
          this.pushEvent("start_public_message", {
            nickname: this.el.dataset.privateNickname,
          })
        }, 250)
      }

      this.onDoubleClick = () => {
        window.clearTimeout(this.clickTimer)
        this.pushEvent("start_private_message", {
          nickname: this.el.dataset.privateNickname,
        })
      }

      this.el.addEventListener("click", this.onClick)
      this.el.addEventListener("dblclick", this.onDoubleClick)
    },
    destroyed() {
      window.clearTimeout(this.clickTimer)
      this.el.removeEventListener("click", this.onClick)
      this.el.removeEventListener("dblclick", this.onDoubleClick)
    },
  },
  PrivateMessageComposer: {
    mounted() {
      this.input = this.el.querySelector("#message-body")
      this.clientIdInput = this.el.querySelector("#message-client-id")
      this.isTyping = false
      this.connected = true
      this.inFlight = new Set()
      this.ackTimers = new Map()

      this.newClientId = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID()

        return `message-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }

      this.restoreDraft = () => {
        try {
          const draft = JSON.parse(sessionStorage.getItem(MESSAGE_DRAFT_KEY) || "null")
          if (!draft?.body || !this.input) return

          this.input.value = draft.body
          if (this.clientIdInput) this.clientIdInput.value = draft.clientId || this.newClientId()
        } catch (_error) {
          sessionStorage.removeItem(MESSAGE_DRAFT_KEY)
        }
      }

      this.saveDraft = () => {
        const body = this.input?.value || ""

        if (!body.trim()) {
          sessionStorage.removeItem(MESSAGE_DRAFT_KEY)
          return
        }

        if (this.clientIdInput && !this.clientIdInput.value) {
          this.clientIdInput.value = this.newClientId()
        }

        sessionStorage.setItem(
          MESSAGE_DRAFT_KEY,
          JSON.stringify({body, clientId: this.clientIdInput?.value || this.newClientId()}),
        )
      }

      this.restoreDraft()

      this.stopTyping = () => {
        window.clearTimeout(this.typingTimer)
        if (!this.isTyping) return
        this.isTyping = false
        this.pushEvent("typing", {typing: false})
      }

      this.handleEvent("clear-message-draft", () => {
        sessionStorage.removeItem(MESSAGE_DRAFT_KEY)
        if (this.input) this.input.value = ""
        if (this.clientIdInput) this.clientIdInput.value = ""
        this.stopTyping()
      })

      this.clearComposerFor = clientId => {
        if (this.clientIdInput?.value !== clientId) return
        sessionStorage.removeItem(MESSAGE_DRAFT_KEY)
        if (this.input) this.input.value = ""
        if (this.clientIdInput) this.clientIdInput.value = ""
        this.stopTyping()
      }

      this.finishAttempt = clientId => {
        this.inFlight.delete(clientId)
        window.clearTimeout(this.ackTimers.get(clientId))
        this.ackTimers.delete(clientId)
      }

      this.handleEvent("public-message-acknowledged", payload => {
        this.finishAttempt(payload.client_id)
        updateMessageOutboxEntry(payload.client_id, {
          state: "confirmed",
          messageId: payload.message_id,
        })
        this.clearComposerFor(payload.client_id)
      })

      this.handleEvent("public-message-rejected", payload => {
        this.finishAttempt(payload.client_id)

        if (payload.reason === "rate_limited") {
          updateMessageOutboxEntry(payload.client_id, {
            state: "blocked",
            error: "rate_limited",
          })
          return
        }

        updateMessageOutboxEntry(payload.client_id, {
          state: "failed",
          error: payload.reason || "send_failed",
        })
      })

      this.sendOutboxEntry = entry => {
        if (this.inFlight.has(entry.clientId)) return
        if (!this.connected) {
          updateMessageOutboxEntry(entry.clientId, {state: "retrying"})
          return
        }

        this.inFlight.add(entry.clientId)
        updateMessageOutboxEntry(entry.clientId, {state: "sending", error: null})
        this.pushEvent("send_message", {
          message: {body: entry.body, client_id: entry.clientId},
        })

        this.ackTimers.set(
          entry.clientId,
          window.setTimeout(() => {
            this.inFlight.delete(entry.clientId)
            this.ackTimers.delete(entry.clientId)
            updateMessageOutboxEntry(entry.clientId, {state: "retrying"})
          }, MESSAGE_ACK_TIMEOUT_MS),
        )
      }

      this.retryOutbox = () => {
        readMessageOutbox()
          .filter(
            entry =>
              entry.state !== "blocked" && entry.state !== "failed" && entry.state !== "confirmed",
          )
          .forEach(entry => this.sendOutboxEntry(entry))
      }

      this.onOutboxRetry = event => {
        const entry = readMessageOutbox().find(item => item.clientId === event.detail?.clientId)
        if (!entry) return
        updateMessageOutboxEntry(entry.clientId, {state: "retrying", error: null})
        this.sendOutboxEntry(entry)
      }

      this.onSubmit = event => {
        const body = this.input?.value.trim() || ""
        if (!body || body.startsWith("/") || body.startsWith("^")) return

        event.preventDefault()
        event.stopPropagation()

        const clientId = this.clientIdInput?.value || this.newClientId()
        if (this.clientIdInput) this.clientIdInput.value = clientId
        const entry = {
          clientId,
          body,
          state: "sending",
          createdAt: new Date().toISOString(),
        }
        const existingEntries = readMessageOutbox().filter(item => item.clientId !== clientId)

        writeMessageOutbox([...existingEntries, entry])
        this.clearComposerFor(clientId)
        this.sendOutboxEntry(entry)
      }

      this.onInput = () => {
        const hasText = this.input?.value.trim().length > 0
        window.clearTimeout(this.typingTimer)
        this.saveDraft()

        if (!hasText) {
          this.stopTyping()
          return
        }

        if (!this.isTyping) {
          this.isTyping = true
          this.pushEvent("typing", {typing: true})
        }

        this.typingTimer = window.setTimeout(this.stopTyping, 1500)
      }

      this.onKeydown = event => {
        if (event.key !== "Enter" || !event.ctrlKey || event.isComposing) return

        event.preventDefault()
        const input = this.el.querySelector("#message-body")
        if (!input) return

        this.pushEvent("send_private_message", {body: input.value}, reply => {
          if (reply.ok) {
            input.value = ""
            this.stopTyping()
          }
        })
      }

      this.input?.addEventListener("input", this.onInput)
      this.el.addEventListener("keydown", this.onKeydown)
      this.el.addEventListener("submit", this.onSubmit)
      window.addEventListener(MESSAGE_OUTBOX_RETRY_EVENT, this.onOutboxRetry)
      this.retryOutbox()
    },
    updated() {
      this.restoreDraft()
    },
    destroyed() {
      window.clearTimeout(this.typingTimer)
      this.ackTimers.forEach(timer => window.clearTimeout(timer))
      this.input?.removeEventListener("input", this.onInput)
      this.el.removeEventListener("keydown", this.onKeydown)
      this.el.removeEventListener("submit", this.onSubmit)
      window.removeEventListener(MESSAGE_OUTBOX_RETRY_EVENT, this.onOutboxRetry)
    },
    disconnected() {
      this.connected = false
      this.inFlight.clear()
      this.ackTimers.forEach(timer => window.clearTimeout(timer))
      this.ackTimers.clear()
      writeMessageOutbox(
        readMessageOutbox().map(entry =>
          entry.state === "failed" || entry.state === "confirmed"
            || entry.state === "blocked"
            ? entry
            : {...entry, state: "retrying"},
        ),
      )
    },
    reconnected() {
      this.connected = true
      this.retryOutbox()
    },
  },
  ChatMessages: {
    mounted() {
      const lastHydratedAt = Number(sessionStorage.getItem(MESSAGE_HYDRATED_AT_KEY))
      const recentlyHydrated =
        Number.isSafeInteger(lastHydratedAt) &&
        Date.now() - lastHydratedAt < MESSAGE_REHYDRATION_COOLDOWN_MS
      this.initializing = !recentlyHydrated
      sessionStorage.setItem(MESSAGE_HYDRATED_AT_KEY, String(Date.now()))
      this.scheduleInitialScroll = () => {
        cancelAnimationFrame(this.initialScrollFrame)

        this.initialScrollFrame = requestAnimationFrame(() => {
          this.initialScrollFrame = requestAnimationFrame(() => this.scrollToBottom())
        })
      }

      if (this.initializing) {
        this.scheduleInitialScroll()
        this.initialScrollTimer = window.setTimeout(() => {
          this.initializing = false
        }, 1_000)
      }

      this.resizeObserver = new ResizeObserver(() => {
        if (this.initializing) this.scheduleInitialScroll()
      })
      this.resizeObserver.observe(this.el)

      this.storeMessageCursor = () => {
        const messageIds = [...this.el.querySelectorAll("[data-message-id]")]
          .map(message => Number.parseInt(message.dataset.messageId, 10))
          .filter(Number.isSafeInteger)

        if (messageIds.length > 0) {
          sessionStorage.setItem(MESSAGE_CURSOR_KEY, String(Math.max(...messageIds)))
        }
      }

      // PubSub normally delivers every message immediately. This inexpensive
      // cursor check is a safety net for a tab whose transport briefly became
      // stale without completing a visible reconnect cycle.
      this.syncMissedMessages = () => {
        const cursor = sessionStorage.getItem(MESSAGE_CURSOR_KEY)

        if (/^\d+$/.test(cursor || "")) {
          this.pushEvent("sync_messages", {cursor})
        }
      }

      this.messageSyncTimer = window.setInterval(
        this.syncMissedMessages,
        MESSAGE_SYNC_INTERVAL_MS,
      )

      this.pendingMessages = this.el.querySelector("#pending-messages")
      this.renderedOutboxClientIds = new Set()

      this.renderOutbox = () => {
        if (!this.pendingMessages) return

        const entries = readMessageOutbox()
        const addedEntry = entries.find(entry => !this.renderedOutboxClientIds.has(entry.clientId))
        this.pendingMessages.replaceChildren(...entries.map(entry => this.buildPendingMessage(entry)))
        this.renderedOutboxClientIds = new Set(entries.map(entry => entry.clientId))

        // Optimistic entries are inserted directly by this hook, so LiveView's
        // `updated` callback does not run to reveal them. A message just sent by
        // this tab must remain visible even when the confirmed stream is long.
        if (addedEntry && !this.initializing) {
          this.scrollToBottom({smooth: true})
        }
      }

      this.reconcileOutbox = () => {
        const confirmedClientIds = [...this.el.querySelectorAll("[data-client-id]")]
          .map(message => message.dataset.clientId)
          .filter(Boolean)
        const confirmed = new Set(confirmedClientIds)
        const entries = readMessageOutbox()
        const pending = entries.filter(entry => !confirmed.has(entry.clientId))

        if (pending.length !== entries.length) writeMessageOutbox(pending)
      }

      this.onOutboxChanged = () => this.renderOutbox()
      this.onPendingClick = event => {
        const retry = event.target.closest("[data-retry-client-id]")
        const cancel = event.target.closest("[data-cancel-client-id]")

        if (retry) {
          window.dispatchEvent(
            new CustomEvent(MESSAGE_OUTBOX_RETRY_EVENT, {
              detail: {clientId: retry.dataset.retryClientId},
            }),
          )
        }

        if (cancel) acknowledgeOutboxMessage(cancel.dataset.cancelClientId)
      }
      this.pendingMessages?.addEventListener("click", this.onPendingClick)
      window.addEventListener(MESSAGE_OUTBOX_CHANGED_EVENT, this.onOutboxChanged)

      this.reconcileOutbox()
      this.renderOutbox()
      this.storeMessageCursor()
    },
    updated() {
      this.reconcileOutbox()
      this.renderOutbox()
      this.storeMessageCursor()

      if (this.initializing) {
        this.scheduleInitialScroll()
        return
      }

      this.scrollToBottom({smooth: true})
    },
    disconnected() {
      // Prevent LiveView's reconnect join patch from clearing stream children before
      // the server has a chance to append only the messages missed during the outage.
      this.el.setAttribute("phx-update", "ignore")
    },
    reconnected() {
      // The reconnect join patch intentionally preserved the old stream DOM with
      // `phx-update="ignore"`. Return it to stream mode before asking the server
      // for missed entries; otherwise acknowledged outbox messages remain as
      // local one-tick placeholders until the page is reloaded.
      this.el.setAttribute("phx-update", "stream")
      this.syncMissedMessages()
    },
    destroyed() {
      cancelAnimationFrame(this.scrollAnimationFrame)
      cancelAnimationFrame(this.initialScrollFrame)
      window.clearTimeout(this.initialScrollTimer)
      window.clearInterval(this.messageSyncTimer)
      this.resizeObserver?.disconnect()
      this.pendingMessages?.removeEventListener("click", this.onPendingClick)
      window.removeEventListener(MESSAGE_OUTBOX_CHANGED_EVENT, this.onOutboxChanged)
    },
    buildPendingMessage(entry) {
      const wrapper = document.createElement("article")
      wrapper.id = `pending-message-${entry.clientId}`
      wrapper.dataset.pendingClientId = entry.clientId
      wrapper.dataset.deliveryState = entry.state || "retrying"
      wrapper.className =
        "chat-message-entry relative mt-2 rounded border border-dashed border-zinc-700 bg-zinc-900/70 px-3 pb-2 pt-5 opacity-80"

      const author = document.createElement("span")
      author.className =
        "chat-message-author absolute -top-2 left-2 max-w-[65%] truncate rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold leading-4 text-amber-200"
      author.textContent = this.pendingMessages?.dataset.nickname || "Вы"

      const body = document.createElement("p")
      body.className = "chat-message-body break-words pr-12 text-sm leading-5 text-zinc-200"
      body.textContent = entry.body

      const controls = document.createElement("div")
      controls.className =
        entry.state === "blocked" || entry.state === "failed"
          ? "mt-1 flex items-center gap-2 text-[11px] text-zinc-500"
          : "absolute right-2 top-1 text-[11px] text-zinc-500"

      const indicator = document.createElement("span")
      indicator.dataset.deliveryIndicator = ""
      indicator.setAttribute("aria-hidden", "true")
      indicator.className =
        "inline-flex min-w-3 justify-center font-bold leading-none " +
        (entry.state === "blocked" || entry.state === "failed"
          ? "text-red-400"
          : entry.state === "confirmed"
            ? "text-sky-400"
            : "text-zinc-500")
      indicator.textContent = entry.state === "blocked" || entry.state === "failed" ? "!" : "✓"

      const status = document.createElement("span")
      status.dataset.deliveryStatus = ""
      status.className = "sr-only"
      status.textContent =
        entry.state === "blocked"
          ? "Заблокировано лимитом — сообщение видно только вам"
          : entry.state === "failed"
          ? "Не отправлено"
          : entry.state === "confirmed"
            ? "Принято сервером — ожидает публикации в истории"
          : entry.state === "retrying"
            ? "Сохранено на устройстве — ждёт восстановления связи"
            : "Сохранено на устройстве — отправляется на сервер"
      controls.append(indicator, status)

      if (entry.state === "blocked") {
        const blocked = document.createElement("span")
        blocked.className = "text-red-300"
        blocked.textContent = "Заблокировано лимитом"
        controls.append(blocked)
      }

      if (entry.state === "failed") {
        const retry = document.createElement("button")
        retry.type = "button"
        retry.dataset.retryClientId = entry.clientId
        retry.className = "font-semibold text-amber-200 hover:underline"
        retry.textContent = "Повторить"

        const cancel = document.createElement("button")
        cancel.type = "button"
        cancel.dataset.cancelClientId = entry.clientId
        cancel.className = "text-zinc-400 hover:text-zinc-200 hover:underline"
        cancel.textContent = "Удалить"
        controls.append(retry, cancel)
      }

      wrapper.append(author, body, controls)
      return wrapper
    },
    scrollToBottom({smooth = false} = {}) {
      cancelAnimationFrame(this.scrollAnimationFrame)
      const target = Math.max(0, this.el.scrollHeight - this.el.clientHeight)

      if (
        !smooth ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          Math.abs(target - this.el.scrollTop) < 1
      ) {
        this.el.scrollTop = target
        return
      }

      const start = this.el.scrollTop
      const distance = target - start
      const duration = Math.min(600, Math.max(280, Math.abs(distance) * 0.3))
      const startedAt = performance.now()

      const animate = now => {
        const progress = Math.min(1, (now - startedAt) / duration)
        const easedProgress = 1 - Math.pow(1 - progress, 3)
        this.el.scrollTop = start + distance * easedProgress

        if (progress < 1) this.scrollAnimationFrame = requestAnimationFrame(animate)
      }

      this.scrollAnimationFrame = requestAnimationFrame(animate)
    },
  },
  ChatPreferences: {
    mounted() {
      window.name = "vertigo-chat"
      this.onVisibilityChange = () => {
        this.reportSessionDebug("visibility_changed")
        if (document.visibilityState === "visible") {
          this.touchChatSession()
        }
      }
      document.addEventListener("visibilitychange", this.onVisibilityChange)

      if (this.el.dataset.chatJoined === "true") {
        this.finishSessionRestoration()
        this.startSessionHeartbeat()
      } else {
        this.restorationTimer = window.setTimeout(() => this.finishSessionRestoration(), 1500)
      }

      this.reportSessionDebug("mounted")

      this.handleEvent("save-chat-preferences", preferences => {
        const nextStore = readChatPreferenceStore()
        const nickname = preferences.nickname

        if (!nickname) {
          return
        }

        nextStore.current_nickname = nickname
        nextStore.by_nickname[nickname] = {
          theme_id: preferences.theme_id,
          appearance: appearanceFrom(preferences),
          font_id: preferences.font_id,
          font_style: preferences.font_style,
          message_sound_enabled: preferences.message_sound_enabled,
        }
        writeChatPreferenceStore(nextStore)
        sessionStorage.setItem(GUEST_SESSION_KEY, "true")
        sessionStorage.setItem(GUEST_SESSION_TOKEN_KEY, preferences.session_token)
        sessionStorage.setItem(GUEST_NICKNAME_KEY, nickname)
        sessionStorage.setItem(GUEST_IDENTITY_TOKEN_KEY, preferences.identity_token)
      })

      this.handleEvent("play-message-notification", () => playMessageNotification())

      this.handleEvent("clear-guest-session", () => {
        clearGuestSession()
      })
    },
    reconnected() {
      this.reportSessionDebug("reconnected")
      this.startSessionHeartbeat()
    },
    updated() {
      if (this.el.dataset.chatJoined === "true") {
        this.finishSessionRestoration()
        this.startSessionHeartbeat()
      } else {
        this.stopSessionHeartbeat()
      }
    },
    destroyed() {
      window.clearTimeout(this.restorationTimer)
      document.removeEventListener("visibilitychange", this.onVisibilityChange)
      this.stopSessionHeartbeat()
    },
    finishSessionRestoration() {
      window.clearTimeout(this.restorationTimer)
      delete document.documentElement.dataset.chatSessionRestoring
      delete document.documentElement.dataset.chatSessionRestoreTimedOut
    },
    startSessionHeartbeat() {
      if (this.sessionHeartbeat || this.el.dataset.chatJoined !== "true") {
        return
      }

      this.touchChatSession()
      this.sessionHeartbeat = window.setInterval(() => this.touchChatSession(), 60_000)
    },
    stopSessionHeartbeat() {
      window.clearInterval(this.sessionHeartbeat)
      this.sessionHeartbeat = null
    },
    touchChatSession() {
      if (this.el.dataset.chatJoined === "true") {
        this.pushEvent("touch_chat_session", {visibility: document.visibilityState})
      }
    },
    reportSessionDebug(event) {
      if (this.el.dataset.sessionDebug === "true" && this.el.dataset.chatJoined === "true") {
        this.pushEvent("session_debug_client", {event, visibility: document.visibilityState})
      }
    },
  },
  ListeningAudio: {
    mounted() {
      this.track = this.el.dataset.trackTitle || ""
      this.listening = false
      this.started = () => {
        this.listening = true
        this.pushEvent("music_started", {track: this.track})
      }
      this.stopped = () => {
        if (!this.listening) return
        this.listening = false
        this.pushEvent("music_stopped", {track: this.track})
      }
      this.el.addEventListener("play", this.started)
      this.el.addEventListener("pause", this.stopped)
      this.el.addEventListener("ended", this.stopped)
    },
    destroyed() {
      this.stopped()
      this.el.removeEventListener("play", this.started)
      this.el.removeEventListener("pause", this.stopped)
      this.el.removeEventListener("ended", this.stopped)
    },
  },
}

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  uploaders: Uploaders,
  longPollFallbackMs: LONG_POLL_FALLBACK_MS,
  sessionStorage: liveSocketSessionStorage,
  params: () => ({_csrf_token: csrfToken, ...chatSessionParams()}),
  hooks: {...colocatedHooks, ...chatHooks, MediaSharing},
})

let gameAudioContext = null
let lastGameSoundAt = 0

const playGameSound = kind => {
  const now = performance.now()

  // One quiet, short response per deliberate move is enough; never create a soundtrack.
  if (now - lastGameSoundAt < 90) return
  lastGameSoundAt = now

  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return

  gameAudioContext ||= new AudioContext()
  if (gameAudioContext.state === "suspended") gameAudioContext.resume()

  const notes = {card: 392, checker: 220, shot: 104, tile: 523}
  const oscillator = gameAudioContext.createOscillator()
  const gain = gameAudioContext.createGain()
  const startedAt = gameAudioContext.currentTime

  oscillator.type = kind === "shot" ? "triangle" : "sine"
  oscillator.frequency.setValueAtTime(notes[kind] || 330, startedAt)
  gain.gain.setValueAtTime(0.0001, startedAt)
  gain.gain.exponentialRampToValueAtTime(0.035, startedAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.085)
  oscillator.connect(gain).connect(gameAudioContext.destination)
  oscillator.start(startedAt)
  oscillator.stop(startedAt + 0.09)
}

document.addEventListener("click", event => {
  const gameControl = event.target.closest("[data-game-sound]")
  if (gameControl && !gameControl.disabled) playGameSound(gameControl.dataset.gameSound)

  const link = event.target.closest("[data-return-to-chat]")
  if (!link || event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  const chatWindow = window.open("", "vertigo-chat")
  event.preventDefault()

  // A section opened in the chat tab keeps its name. Focusing that same
  // window would leave the user stranded on the section instead of returning.
  if (!chatWindow || chatWindow === window) {
    window.location.href = link.href
    return
  }

  try {
    if (new URL(chatWindow.location.href).pathname !== "/chat") {
      chatWindow.location.href = link.href
    }
  } catch {
    // The named tab may have since navigated to another origin.
    chatWindow.location.href = link.href
  }
  chatWindow.focus()
})
window.addEventListener("phx:clear-message-input", _info => {
  sessionStorage.removeItem(MESSAGE_DRAFT_KEY)

  document.getElementById("emoji-input-controls")?.dispatchEvent(
    new CustomEvent("chat:clear-emoji-filter")
  )

  const messageInput = document.getElementById("message-body")

  if (messageInput) {
    messageInput.value = ""

    if (document.activeElement !== messageInput && window.matchMedia("(pointer: fine)").matches) {
      messageInput.focus({preventScroll: true})
    }
  }
})

window.addEventListener("phx:focus-message-input", _info => {
  requestAnimationFrame(() => {
    const messageInput = document.getElementById("message-body")

    if (messageInput && window.matchMedia("(pointer: fine)").matches) {
      messageInput.focus({preventScroll: true})
      messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length)
    }
  })
})

window.addEventListener("phx:save-user-auth", event => {
  sessionStorage.setItem(USER_AUTH_KEY, event.detail.token)
  sessionStorage.setItem(USER_SESSION_KEY, event.detail.session_token)
})

window.addEventListener("phx:clear-user-auth", _event => {
  sessionStorage.removeItem(USER_AUTH_KEY)
  sessionStorage.removeItem(USER_SESSION_KEY)
})

// This event is dispatched before the LiveView `leave_chat` push. A navigation
// or network loss immediately after the click therefore cannot restore a
// session that the person explicitly chose to leave.
window.addEventListener("phx:clear-chat-session", _event => clearChatSession())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

// The lines below enable quality of life phoenix_live_reload
// development features:
//
//     1. stream server logs to the browser console
//     2. click on elements to jump to their definitions in your code editor
//
if (process.env.NODE_ENV === "development") {
  window.addEventListener("phx:live_reload:attached", ({detail: reloader}) => {
    // Enable server log streaming to client.
    // Disable with reloader.disableServerLogs()
    reloader.enableServerLogs()

    // Open configured PLUG_EDITOR at file:line of the clicked element's HEEx component
    //
    //   * click with "c" key pressed to open at caller location
    //   * click with "d" key pressed to open at function component definition location
    let keyDown
    window.addEventListener("keydown", e => keyDown = e.key)
    window.addEventListener("keyup", _e => keyDown = null)
    window.addEventListener("click", e => {
      if(keyDown === "c"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtCaller(e.target)
      } else if(keyDown === "d"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtDef(e.target)
      }
    }, true)

    window.liveReloader = reloader
  })
}

// Account cookies are shared across tabs; chat resume tokens remain tab-local.
const accountChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("vertigo-account") : null
accountChannel?.addEventListener("message", () => {
  if (!document.querySelector("#chat-room") && !document.querySelector("#vertigo-landing")) {
    window.location.reload()
  }
})
document.addEventListener("submit", async event => {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-account-logout")) return
  event.preventDefault()
  const button = form.querySelector("button[type=submit]")
  if (button) button.disabled = true
  try {
    const response = await fetch(form.action, {
      method: "POST", credentials: "same-origin", body: new FormData(form),
    })
    if (!response.ok) throw new Error("Account logout failed")
    accountChannel?.postMessage("changed")
    window.location.assign(response.url)
  } catch (_error) {
    // Keep the ordinary HTML form as a fallback when fetch is unavailable.
    HTMLFormElement.prototype.submit.call(form)
  }
})
