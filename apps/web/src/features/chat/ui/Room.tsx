import { useDesktopPlayer } from "../model/player/useDesktopPlayer"
import { PlayerProvider } from "./player/PlayerProvider"
import { PlayerDock } from "./player/PlayerDock"
import { ListeningContext } from "../model/listeningContext"
import { useRef, useState, type ReactNode } from "react"
import type { Message } from "../api/protocol"
import { useNotification } from "../model/useNotification"
import { useMediaSearch } from "../model/useMediaSearch"
import { MediaSearchResults } from "./MediaSearchResults"
import { useMediaTransfer } from "../model/useMediaTransfer"
import { RoomForms } from "./RoomForms"
import { useRoomForm } from "../model/useRoomForm"
import { TopMenu } from "./TopMenu"
import { Composer } from "./Composer"
import { Settings } from "./Settings"
import { CommandResults } from "./CommandResults"
import { usePreferences } from "../model/usePreferences"
import { useRoomCommands } from "../model/useRoomCommands"
import { useEmojis } from "../model/useEmojis"
import { OnlineList } from "./OnlineList"
import { MessageFeed } from "./MessageFeed"
import { useRoom } from "../model/useRoom"
import { feedTimeline, timelineMessages } from "../model/timeline"
export function Room({
  onProfile,
  csrf,
  children,
  onGame,
  unreadNotes,
}: {
  onProfile: (nickname: string, editable: boolean) => void
  csrf: string
  children?: ReactNode
  onGame?: (argument: string) => void
  unreadNotes: number
}) {
  const { state, connection } = useRoom()
  const publishedMessages = timelineMessages(state.timeline)
  const feedEntries = feedTimeline(state.timeline, state.ephemeral)
  const [draft, setDraft] = useState("")
  const [reply, setReply] = useState<Message | null>(null)
  const [notesNoticeDismissed, setNotesNoticeDismissed] = useState(false)
  const settings = usePreferences(state.snapshot.preferences, connection)
  const emoji = useEmojis()
  const media = useMediaTransfer(connection, state.snapshot.peers, state.nickname)
  const forms = useRoomForm(csrf, state, connection, media.share)
  const registered = state.snapshot.peers.some((p) => p.self && p.registered)
  const openProfile = (nickname: string) => {
    onProfile(nickname, registered && nickname === state.nickname)
  }
  const search = useMediaSearch(state.generation, (item) => {
    connection.sendMedia(item)
  })
  const command = useRoomCommands(
    [...publishedMessages, ...state.ephemeral].sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at)),
    state.snapshot.peers,
    openProfile,
    () => {
      connection.leave()
    },
    search.search,
    settings.show,
    onGame,
  )
  useNotification(
    [...publishedMessages, ...state.ephemeral],
    state.nickname,
    state.snapshot.preferences.message_sound_enabled,
  )
  const input = useRef<HTMLInputElement>(null)
  const joined = state.status === "ready" || state.status === "reconnecting"
  const usePlayer = useDesktopPlayer(state.snapshot.preferences.appearance.use_player ?? false)
  const address = (nickname: string) => {
    setDraft(`${nickname}, `)
    input.current?.focus()
  }
  return (
    <ListeningContext.Provider value={connection}>
      <PlayerProvider
        enabled={usePlayer}
        nickname={joined ? state.nickname : ""}
        key={`${state.nickname}:${String(joined)}`}
      >
        <section
          id="chat-room"
          data-chat-theme={state.snapshot.preferences.theme_id}
          data-chat-mode={
            ["newspaper", "autumn_sunny"].includes(state.snapshot.preferences.theme_id) ? "light" : "dark"
          }
          data-chat-joined={joined}
          className="chat-shell relative isolate flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100"
        >
          <TopMenu
            registered={registered}
            unreadNotes={unreadNotes}
            onRegister={() => {
              forms.open("register")
            }}
            onFeedback={() => {
              forms.open("feedback")
            }}
          />
          {unreadNotes > 0 && !notesNoticeDismissed && (
            <div
              id="notes-arrival-notice"
              role="status"
              className="absolute right-4 top-16 z-40 flex max-w-sm items-start gap-3 rounded-xl border border-amber-300/50 bg-zinc-950/95 p-4 text-sm text-amber-100 shadow-2xl backdrop-blur-sm"
            >
              <p className="min-w-0 flex-1">
                Тебя ждут {unreadNotes} {unreadNotes === 1 ? "записка" : "записки"}.{" "}
                <a href="/notes" target="vertigo-notes" className="font-semibold underline">
                  Открыть
                </a>
              </p>
              <button
                id="dismiss-notes-arrival"
                type="button"
                aria-label="Закрыть уведомление о записках"
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => {
                  setNotesNoticeDismissed(true)
                }}
              >
                ×
              </button>
            </div>
          )}
          <div className="chat-room-content">
            {joined ? (
              <main
                id="dialogue-frame"
                className="relative flex min-h-0 min-w-0 flex-col border-b border-zinc-800 bg-zinc-950 md:border-b-0 md:border-r"
              >
                {state.status === "reconnecting" && (
                  <div
                    id="chat-connection-status"
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/45 p-4"
                  >
                    <p className="rounded-lg border border-amber-300/50 bg-zinc-950/95 px-5 py-3 text-sm text-amber-100 shadow-xl">
                      Восстанавливаем связь…
                    </p>
                  </div>
                )}
                <MessageFeed
                  help={state.help}
                  onSettings={settings.show}
                  files={media.files}
                  onRequestFile={media.request}
                  entries={feedEntries.filter((entry) => command.isVisible(entry.message))}
                  frame={state.snapshot.preferences.appearance.message_frame}
                  onRetry={(id) => {
                    connection.retryMessage(id)
                  }}
                  onCancel={(id) => {
                    connection.cancelMessage(id)
                  }}
                  emojis={emoji.emojis}
                  peers={state.snapshot.peers}
                  nickname={state.nickname}
                  onAddress={address}
                  onReply={(message) => {
                    setReply(message)
                    input.current?.focus()
                  }}
                  onReaction={(id, emoji, active) => {
                    connection.setReaction(id, emoji, active)
                  }}
                  onDelete={
                    state.snapshot.admin
                      ? (id) => {
                          connection.deleteMessage(id)
                        }
                      : undefined
                  }
                >
                  <MediaSearchResults
                    frame={state.snapshot.preferences.appearance.message_frame}
                    result={search.result}
                    onClose={() => {
                      search.close()
                      input.current?.focus()
                    }}
                    onRetry={search.retry}
                    onPage={search.page}
                    onSend={(item) => {
                      search.close()
                      connection.sendMedia(item)
                      input.current?.focus()
                    }}
                  />
                  <CommandResults results={command.results} onAddress={address} onDismiss={command.dismiss} />
                </MessageFeed>
                <p
                  id="typing-indicator"
                  aria-live="polite"
                  className="min-h-6 shrink-0 break-words px-4 text-xs italic leading-6 text-zinc-500"
                >
                  {!state.snapshot.preferences.appearance.hide_typing && state.snapshot.typing.length > 0
                    ? `${state.snapshot.typing.join(", ")} печатает…`
                    : ""}
                </p>
              </main>
            ) : (
              <main
                id="chat-entrance-screen"
                className="flex min-h-0 flex-col items-center justify-center overflow-y-auto border-b border-zinc-800 bg-zinc-950 p-4 md:border-b-0 md:border-r"
              >
                <div className="w-full max-w-md text-center">
                  <h1 className="text-3xl font-semibold">
                    {state.status === "loading" ? "Восстанавливаем сессию…" : "Вход в чат"}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {state.error || "Войди на главной странице, чтобы присоединиться к разговору."}
                  </p>
                  {state.status !== "loading" && (
                    <a
                      id="chat-login-link"
                      href="/"
                      className="mt-6 inline-flex rounded bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
                    >
                      Войти на главной
                    </a>
                  )}
                </div>
              </main>
            )}
            {joined && <PlayerDock />}
            <div className="chat-room-sidebar">
              <OnlineList
                hideKarmik={state.snapshot.preferences.appearance.hide_karmik ?? false}
                mood={state.karmikMood}
                onPet={() => {
                  connection.petKarmik()
                }}
                peers={joined ? state.snapshot.peers : []}
                reconnecting={state.status === "reconnecting"}
                onAddress={address}
                onProfile={openProfile}
                {...(joined ? { onSettings: settings.show } : {})}
              />
            </div>
          </div>
          {joined && (
            <Composer
              draft={draft}
              reply={reply}
              onCancelReply={() => {
                setReply(null)
                input.current?.focus()
              }}
              onDraft={(text) => {
                setDraft(text)
                connection.typing(text.length > 0)
              }}
              input={input}
              onSend={() => {
                if (command.execute(draft) || connection.send(draft, reply?.id)) {
                  setDraft("")
                  setReply(null)
                }
              }}
              onLeave={() => {
                connection.leave()
              }}
              registered={registered}
              error={state.error || media.error}
              emojis={emoji.emojis}
              emojiError={emoji.error}
              onEmojiRetry={emoji.retry}
              onUploadEmoji={() => {
                forms.open("emoji")
              }}
              onAttach={() => {
                forms.open("attachment")
              }}
              onAttachFile={(file) => {
                void media.share(file).catch(() => undefined)
              }}
            />
          )}
          <RoomForms form={forms} nickname={state.nickname} registered={registered} />
          {children}
          {settings.draft && (
            <Settings
              value={settings.draft}
              onChange={settings.setDraft}
              nickname={state.nickname}
              onClose={settings.close}
              onSave={settings.save}
              saving={settings.saving}
              error={settings.error}
            />
          )}
        </section>
      </PlayerProvider>
    </ListeningContext.Provider>
  )
}
