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
import topbar from "../vendor/topbar"
import MediaSharing from "./media_sharing"
import "./theme"

const CHAT_PREFERENCES_KEY = "chat:guest-preferences"
const USER_AUTH_KEY = "chat:user-auth"
const USER_SESSION_KEY = "chat:user-session"
const GUEST_SESSION_KEY = "chat:guest-session"
const GUEST_SESSION_TOKEN_KEY = "chat:guest-session-token"

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

const appearanceFrom = preferences => {
  return preferences.appearance || {}
}

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
  const userAuthToken = sessionStorage.getItem(USER_AUTH_KEY)

  if (userAuthToken) {
    return {
      user_auth_token: userAuthToken,
      chat_session_token: sessionStorage.getItem(USER_SESSION_KEY),
    }
  }

  const store = readChatPreferenceStore()
  const currentNickname = store.current_nickname
  const currentPreferences = currentNickname && store.by_nickname[currentNickname]

  if (sessionStorage.getItem(GUEST_SESSION_KEY) && currentNickname && currentPreferences) {
    return {
      guest_nickname: currentNickname,
      guest_session_token: sessionStorage.getItem(GUEST_SESSION_TOKEN_KEY),
      theme_id: currentPreferences.theme_id,
      appearance: appearanceFrom(currentPreferences),
      font_id: currentPreferences.font_id,
      font_style: currentPreferences.font_style,
      message_sound_enabled: currentPreferences.message_sound_enabled,
    }
  }

  return {}
}

if (Object.keys(chatSessionParams()).length > 0) {
  document.documentElement.dataset.chatSessionRestoring = "true"
}

const chatHooks = {
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
      this.isTyping = false

      this.stopTyping = () => {
        window.clearTimeout(this.typingTimer)
        if (!this.isTyping) return
        this.isTyping = false
        this.pushEvent("typing", {typing: false})
      }

      this.onInput = () => {
        const hasText = this.input?.value.trim().length > 0
        window.clearTimeout(this.typingTimer)

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
    },
    destroyed() {
      window.clearTimeout(this.typingTimer)
      this.input?.removeEventListener("input", this.onInput)
      this.el.removeEventListener("keydown", this.onKeydown)
    },
  },
  ChatMessages: {
    mounted() {
      this.shouldStickToBottom = true
      this.autoScrolling = false
      this.scrollToBottom()
    },
    beforeUpdate() {
      this.shouldStickToBottom =
        this.autoScrolling ||
          this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 80
      this.previousScrollHeight = this.el.scrollHeight
    },
    updated() {
      if (!this.shouldStickToBottom) return

      const addedHeight = this.el.scrollHeight - this.previousScrollHeight
      if (addedHeight > 0) this.revealLatestMessage(addedHeight)
    },
    destroyed() {
      cancelAnimationFrame(this.scrollAnimationFrame)
    },
    scrollToBottom() {
      cancelAnimationFrame(this.scrollAnimationFrame)
      this.el.scrollTop = this.el.scrollHeight
      this.autoScrolling = false
    },
    revealLatestMessage(addedHeight) {
      cancelAnimationFrame(this.scrollAnimationFrame)

      const startTop = this.el.scrollTop
      const maxTop = this.el.scrollHeight - this.el.clientHeight
      const targetTop = Math.min(startTop + addedHeight, maxTop)
      const distance = targetTop - startTop

      if (distance <= 0) {
        this.autoScrolling = false
        return
      }

      const startedAt = performance.now()
      const duration = 900
      this.autoScrolling = true
      const tick = now => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased =
          progress < 0.5
            ? 4 * Math.pow(progress, 3)
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
        this.el.scrollTop = startTop + distance * eased

        if (progress < 1) {
          this.scrollAnimationFrame = requestAnimationFrame(tick)
        } else {
          this.autoScrolling = false
        }
      }

      this.scrollAnimationFrame = requestAnimationFrame(tick)
    },
  },
  ChatPreferences: {
    mounted() {
      window.name = "vertigo-chat"
      this.onVisibilityChange = () => {
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
      })

      this.handleEvent("play-message-notification", () => playMessageNotification())

      this.handleEvent("clear-guest-session", () => {
        sessionStorage.removeItem(GUEST_SESSION_KEY)
        sessionStorage.removeItem(GUEST_SESSION_TOKEN_KEY)
      })
    },
    reconnected() {
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
      if (this.el.dataset.chatJoined === "true" && document.visibilityState === "visible") {
        this.pushEvent("touch_chat_session", {})
      }
    },
  },
}

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: () => ({_csrf_token: csrfToken, ...chatSessionParams()}),
  hooks: {...colocatedHooks, ...chatHooks, MediaSharing},
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

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
  if (!chatWindow) return

  event.preventDefault()
  if (chatWindow.location.href === "about:blank") chatWindow.location.href = link.href
  chatWindow.focus()
})
window.addEventListener("phx:clear-message-input", _info => {
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
