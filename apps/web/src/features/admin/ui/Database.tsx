import type { Database as Data } from "../api/admin"
export function Database({
  data,
  nickname,
  navigate,
}: {
  data: Data
  nickname: string
  navigate: (url: string) => void
}) {
  return (
    <section
      id="database"
      className="rounded-2xl border border-emerald-950 bg-[#162019] p-5 shadow-xl shadow-black/20 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-300">База данных</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Просмотр таблиц</h2>
          <p className="mt-1 text-sm text-stone-400">Только чтение; отображаются первые 100 строк выбранной таблицы.</p>
        </div>
        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-200">{nickname}</span>
      </div>
      <div id="admin-table-list" className="mt-5 flex flex-wrap gap-2">
        {data.tables.map((table) => (
          <a
            key={table}
            href={"/admin?" + new URLSearchParams({ table }).toString()}
            onClick={(e) => {
              e.preventDefault()
              navigate(e.currentTarget.href)
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${table === data.selected_table ? "border-amber-300 bg-amber-300 text-stone-950" : "border-emerald-900 text-emerald-100 hover:border-emerald-600"}`}
          >
            {table}
          </a>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-emerald-950">
        {data.selected_table ? (
          <table id="admin-database-table" className="min-w-full divide-y divide-emerald-950 text-left text-sm">
            <caption className="bg-[#111a14] px-4 py-3 text-left font-medium text-stone-200">
              {data.selected_table}
            </caption>
            <thead className="bg-emerald-950/40 text-xs uppercase tracking-wide text-emerald-200">
              <tr>
                {data.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/70 text-stone-300">
              {data.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((value, i) => (
                    <td key={data.columns[i]} className="max-w-xs px-4 py-3 align-top break-words">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
              {!data.rows.length && (
                <tr>
                  <td colSpan={Math.max(data.columns.length, 1)} className="px-4 py-8 text-center text-stone-500">
                    В таблице пока нет строк.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p id="admin-database-empty" className="px-4 py-8 text-center text-stone-500">
            Таблицы не найдены.
          </p>
        )}
      </div>
    </section>
  )
}
