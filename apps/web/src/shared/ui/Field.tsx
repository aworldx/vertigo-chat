import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react"
export const inputClass =
  "mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition [color-scheme:dark] placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:bg-zinc-950/40 disabled:text-zinc-500"
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="block">
        {label && <span className="block text-sm font-medium text-zinc-200">{label}</span>}
        <input {...props} className={props.className ?? inputClass} />
      </label>
    </div>
  )
}
export function TextField({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="block">
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        <textarea
          {...props}
          className={
            props.className ??
            "mt-2 block min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-3 text-sm leading-6 text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:bg-zinc-950/40 disabled:text-zinc-500"
          }
        />
      </label>
    </div>
  )
}
