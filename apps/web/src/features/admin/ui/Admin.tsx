import { Notice } from "../../../shared/ui/Notice"
import { useState, useCallback, type ReactNode } from "react"
import { usePageQuery } from "../../../shared/model/usePageQuery"
import { useAdminData } from "../model/useAdminData"
import { Database } from "./Database"
import { Tags } from "./Tags"
import { Emojis } from "./Emojis"
import { EmojiEditor } from "./EmojiEditor"
export function AdminShell({
  children,
  section,
  isAdmin,
  navigate,
}: {
  children: ReactNode
  section: string
  isAdmin: boolean
  navigate: (url: string) => void
}) {
  return (
    <main id="admin-page" className="min-h-dvh bg-[#101612] px-4 py-6 text-stone-100 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-emerald-950 bg-[#162019] p-5 shadow-2xl shadow-black/20">
          <div className="border-b border-emerald-950 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Vertigo</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Админка</h1>
            <p id="admin-chat-version" className="mt-2 text-sm text-emerald-200/70">
              Версия 0.10.3
            </p>
          </div>
          {section && (
            <nav aria-label="Разделы админки" className="mt-5 space-y-1 text-sm">
              {(
                [
                  ["database", "Данные"],
                  ["emojis", "Смайлы"],
                  ["tags", "Теги"],
                ] as const
              )
                .filter(([s]) => s !== "database" || isAdmin)
                .map(([s, title]) => (
                  <a
                    key={s}
                    href={`/admin?section=${s}`}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(e.currentTarget.href)
                    }}
                    className={`block rounded-lg px-3 py-2 ${s === "database" ? "font-medium" : "transition"} ${section === s ? `bg-emerald-900/50 ${s === "database" ? "" : "font-medium "}text-emerald-100` : "text-stone-300 hover:bg-emerald-950 hover:text-white"}`}
                  >
                    {title}
                  </a>
                ))}
            </nav>
          )}
        </aside>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </main>
  )
}
export function Admin({ nickname, isAdmin, csrf }: { nickname: string; isAdmin: boolean; csrf: string }) {
  const { query, navigate } = usePageQuery(),
    params = new URLSearchParams(query),
    requested = params.get("section"),
    section = requested === "tags" || requested === "emojis" ? requested : isAdmin ? "database" : "emojis",
    { content, database, error, refresh } = useAdminData(section, params.get("table") ?? ""),
    selected = Number(params.get("emoji_id")),
    emoji = content?.emojis.find((e) => e.id === selected)
  const [notice, setNotice] = useState("")
  const go = useCallback(
    (url: string) => {
      setNotice("")
      navigate(url)
    },
    [navigate],
  )
  const saved = (message: string) => {
    setNotice(message)
    refresh()
  }
  const close = useCallback(() => {
    go("/admin?section=emojis")
  }, [go])
  return (
    <AdminShell section={section} isAdmin={isAdmin} navigate={go}>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            id="admin-retry"
            onClick={() => {
              refresh()
            }}
          >
            Повторить
          </button>
        </p>
      )}
      {section === "database" && database && <Database data={database} nickname={nickname} navigate={go} />}
      {section === "tags" && content && <Tags tags={content.tags} csrf={csrf} onSaved={saved} />}
      {section === "emojis" && content && (
        <Emojis emojis={content.emojis} csrf={csrf} selected={selected} navigate={go} onSaved={saved}>
          {emoji && (
            <EmojiEditor
              key={emoji.id}
              emoji={emoji}
              tags={content.tags}
              csrf={csrf}
              onClose={close}
              onSaved={(message) => {
                close()
                saved(message)
              }}
            />
          )}
        </Emojis>
      )}
      <Notice
        message={notice}
        onClose={() => {
          setNotice("")
        }}
      />
    </AdminShell>
  )
}
