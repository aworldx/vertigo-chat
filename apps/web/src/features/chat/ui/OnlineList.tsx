import { useEffect, useRef, type CSSProperties } from "react"
import type { Peer } from "../api/protocol"
import { useKarmikPet } from "../model/useKarmikPet"
import { Icon } from "../../../shared/ui/Icon"

const defaultAppearance: CSSProperties & Record<`--${string}`, string> = {
  "--nick-dark": "#fcd34d",
  "--nick-light": "#9a3412",
}

function Presence({ peer, reconnecting }: { peer: Peer; reconnecting: boolean }) {
  return (
    <span
      className="shrink-0 text-[10px] font-medium"
      role={peer.self ? "status" : undefined}
      aria-live={peer.self ? "polite" : undefined}
    >
      {peer.bot && peer.bot_busy ? (
        <span className="chat-presence inline-flex items-center gap-1 text-amber-300">
          <span className="chat-presence-dot size-1.5 rounded-full bg-amber-300" /> Занят
        </span>
      ) : reconnecting ? (
        <span
          id={peer.self ? "current-chatlan-reconnecting" : undefined}
          className="chat-presence inline-flex items-center gap-1 text-amber-300"
          aria-label={`${peer.nickname}: нет связи`}
        >
          <Icon name="arrow-path" className="size-3 motion-safe:animate-spin" /> Нет связи
        </span>
      ) : (
        <span
          id={peer.self ? "current-chatlan-online" : undefined}
          className="chat-presence inline-flex items-center gap-1 text-emerald-300"
        >
          <span className="chat-presence-dot size-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_currentColor]" />В
          сети
        </span>
      )}
    </span>
  )
}

export function OnlineList({
  peers,
  mood = "resting",
  onPet = () => {},
  reconnecting,
  onAddress,
  onProfile,
  onSettings,
}: {
  mood?: "resting" | "happy" | "angry"
  onPet?: () => void
  peers: Peer[]
  reconnecting: boolean
  onAddress: (nickname: string) => void
  onProfile?: (nickname: string) => void
  onSettings?: () => void
}) {
  const pet = useKarmikPet(onPet)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(clickTimer.current)
    },
    [],
  )
  return (
    <aside
      id="chat-online-sidebar"
      aria-label="Участники чата"
      className="hidden min-h-0 flex-col overflow-y-auto bg-zinc-900/80 p-4 md:block md:flex"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold leading-5">Сейчас в чате</h2>
        <div className="flex items-center gap-2">
          <span id="online-count" className="rounded bg-emerald-500/15 px-2 py-1 text-sm text-emerald-300">
            {peers.length}
          </span>
          {onSettings && (
            <button
              id="toggle-settings"
              type="button"
              onClick={onSettings}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-amber-300 hover:text-amber-300"
            >
              Настройки
            </button>
          )}
        </div>
      </div>
      <div id="online-list" className="mt-4">
        {peers.map((peer) => {
          const colors = peer.preferences.appearance
          const appearance = {
            ...defaultAppearance,
            "--nick-dark": colors.dark.nickname_color,
            "--nick-light": colors.light.nickname_color,
          }
          const unavailable = peer.status === "reconnecting" || (peer.self && reconnecting)
          return (
            <div
              key={peer.id}
              id={`online-row-${peer.id}`}
              data-peer-nickname={peer.nickname}
              className="chat-online-row flex items-center gap-2 rounded px-2 py-0.5"
            >
              {peer.bot ? (
                <span className="flex size-7 shrink-0 items-center justify-center text-amber-300" aria-label="Чат-бот">
                  <Icon name="video-camera" className="size-5" />
                </span>
              ) : peer.registered ? (
                <button
                  id={`profile-link-${peer.id}`}
                  type="button"
                  onClick={() => {
                    onProfile?.(peer.nickname)
                  }}
                  aria-label={`Открыть анкету ${peer.nickname}`}
                  className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-amber-300/15 hover:text-amber-300"
                >
                  <Icon name="user-circle" className="size-5" />
                </button>
              ) : (
                <span
                  id={`anonymous-chatlan-${peer.id}`}
                  className="flex size-7 shrink-0 items-center justify-center"
                  title="Анонимный чатланин"
                  aria-label="Анонимный чатланин"
                >
                  <span
                    className="flex size-5 items-center justify-center rounded-full border border-dashed border-zinc-500 text-xs font-semibold text-zinc-400"
                    aria-hidden="true"
                  >
                    ?
                  </span>
                </span>
              )}
              {unavailable ? (
                <span className="min-w-0 flex-1 truncate text-sm font-medium" style={appearance}>
                  {peer.nickname}
                </span>
              ) : (
                <button
                  id={`address-chatlan-${peer.id}`}
                  type="button"
                  className="chat-user-nickname min-w-0 flex-1 truncate text-left text-sm font-medium transition hover:underline"
                  style={appearance}
                  onClick={(event) => {
                    clearTimeout(clickTimer.current)
                    if (event.detail === 0) onAddress(peer.nickname)
                    else
                      clickTimer.current = setTimeout(() => {
                        onAddress(peer.nickname)
                      }, 250)
                  }}
                  onDoubleClick={() => {
                    clearTimeout(clickTimer.current)
                    onAddress(`^${peer.nickname}`)
                  }}
                >
                  {peer.nickname}
                </button>
              )}
              {peer.rank && (
                <span
                  className="ml-1 inline-flex shrink-0 items-center gap-1 align-middle text-[10px] font-medium text-amber-200"
                  title={peer.rank.title}
                  aria-label={peer.rank.title}
                >
                  <img src={peer.rank.icon_url} alt="" className="chat-rank-icon size-4" />
                  <span className="sr-only">{peer.rank.title}</span>
                </span>
              )}
              {peer.listening_track && (
                <span
                  id={`listening-chatlan-${peer.id}`}
                  className="shrink-0 text-fuchsia-200"
                  title={`Слушает: ${peer.listening_track}`}
                  aria-label={`${peer.nickname} слушает: ${peer.listening_track}`}
                >
                  <span aria-hidden="true">🎧</span>
                </span>
              )}
              <Presence peer={peer} reconnecting={unavailable} />
            </div>
          )
        })}
      </div>
      <section
        id="karmik"
        data-mood={mood}
        className="karmik mt-auto hidden lg:flex"
        aria-label="Кармик, хранитель кармы чатлан"
      >
        <div
          id="karmik-sprite"
          className="karmik-sprite"
          role="button"
          tabIndex={0}
          aria-label="Погладить Кармика курсором"
          aria-describedby="karmik-name"
          onPointerMove={() => {
            pet()
          }}
          onPointerDown={() => {
            pet(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              pet(true)
            }
          }}
        />
        {mood === "happy" && (
          <span id="karmik-purr" className="karmik-purr" aria-live="polite">
            Мур-р-р!
          </span>
        )}
        <span id="karmik-name" className="karmik-tooltip" role="tooltip">
          Котик Кармик
        </span>
      </section>
    </aside>
  )
}
