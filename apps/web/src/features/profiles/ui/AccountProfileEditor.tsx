import { useState, type SyntheticEvent } from "react"
import type { Profile } from "../api/profiles"
import { uploadAccountProfilePhoto, updateAccountProfile } from "../api/profiles"

export function AccountProfileEditor({ profile, csrfToken }: { profile: Profile; csrfToken: string }) {
  const [draft, setDraft] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await updateAccountProfile(draft, csrfToken)
      setDraft(result.data)
      setMessage("Анкета сохранена.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить анкету.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      id="account-profile-editor"
      onSubmit={(event) => {
        void save(event)
      }}
      className="mt-8 space-y-5 border-t border-zinc-800 bg-zinc-950/40 p-5 sm:p-7"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Твоя анкета</p>
        <h2 className="mt-1 text-xl font-bold text-white">Редактирование</h2>
      </div>
      <label htmlFor="account-profile-name" className="block text-sm font-semibold text-zinc-200">
        Имя
        <input
          id="account-profile-name"
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
          maxLength={80}
          value={draft.name ?? ""}
          onChange={(event) => {
            setDraft({ ...draft, name: event.target.value || null })
          }}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="account-profile-birth-date" className="block text-sm font-semibold text-zinc-200">
          Дата рождения
          <input
            id="account-profile-birth-date"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
            type="date"
            value={draft.birth_date ?? ""}
            onChange={(event) => {
              setDraft({ ...draft, birth_date: event.target.value || null })
            }}
          />
        </label>
        <label htmlFor="account-profile-gender" className="block text-sm font-semibold text-zinc-200">
          Пол
          <select
            id="account-profile-gender"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
            value={draft.gender ?? ""}
            onChange={(event) => {
              const gender = event.target.value
              setDraft({ ...draft, gender: gender === "" ? null : (gender as Profile["gender"]) })
            }}
          >
            <option value="">Не указан</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="other">Другой</option>
          </select>
        </label>
      </div>
      <label htmlFor="account-profile-about" className="block text-sm font-semibold text-zinc-200">
        О себе
        <textarea
          id="account-profile-about"
          className="mt-2 min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
          maxLength={1000}
          value={draft.about ?? ""}
          onChange={(event) => {
            setDraft({ ...draft, about: event.target.value || null })
          }}
        />
      </label>
      <label htmlFor="account-profile-photo" className="block text-sm font-semibold text-zinc-200">
        Фото
        <input
          id="account-profile-photo"
          className="mt-2 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            void (async () => {
              const photo = event.currentTarget.files?.[0]
              if (!photo) return
              setSaving(true)
              try {
                const result = await uploadAccountProfilePhoto(photo, csrfToken)
                setDraft(result.data)
                setMessage("Фото обновлено.")
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Не удалось загрузить фото.")
              } finally {
                setSaving(false)
              }
            })()
          }}
        />
      </label>
      <p className="text-xs leading-4 text-zinc-500">JPG, PNG или WebP. Фото будет уменьшено до 1280×1280.</p>
      {message && (
        <p role="status" aria-live="polite" className="text-sm text-amber-200">
          {message}
        </p>
      )}
      <button
        id="account-profile-save"
        disabled={saving}
        className="w-full rounded-xl bg-amber-300 px-4 py-3.5 font-semibold text-zinc-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-50"
      >
        Сохранить
      </button>
    </form>
  )
}
