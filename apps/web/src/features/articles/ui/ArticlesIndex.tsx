import { Icon } from "../../../shared/ui/Icon"
export function ArticlesIndex() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      {"\n          "}
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
        {"\n            Vertigo пишет\n          "}
      </p>
      {"\n          "}
      <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-balance sm:text-6xl">
        {"\n            Не инструкции. Разговоры о том, как мы общаемся.\n          "}
      </h1>
      {"\n          "}
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
        {
          "\n            Здесь собираем наблюдения о чатах, дружбе в сети, неловких первых сообщениях\n            и хороших причинах задержаться в общем разговоре.\n          "
        }
      </p>
      {"\n\n          "}
      <section className="mt-12 max-w-4xl" aria-labelledby="latest-articles-title">
        {"\n            "}
        <h2 id="latest-articles-title" className="sr-only">
          {"Последние статьи"}
        </h2>
        {"\n            "}
        <a
          id="article-card-chats-vs-messengers"
          href="/articles/chats-vs-messengers"
          className="group grid overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 transition hover:border-amber-300 lg:grid-cols-[0.9fr_1.1fr]"
        >
          {"\n              "}
          <img
            src="/images/article-chat-window.png"
            alt="Скриншот переписки в Telegram Desktop"
            className="h-full min-h-64 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          {"\n              "}
          <div className="p-7 sm:p-9">
            {"\n                "}
            <p className="text-sm font-semibold text-amber-300">{"Общение"}</p>
            {"\n                "}
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {"\n                  Зачем нужны чаты, когда есть Telegram и соцсети\n                "}
            </h2>
            {"\n                "}
            <p className="mt-4 leading-7 text-zinc-300">
              {
                "\n                  У ленты, личных сообщений и общего чата разные характеры. Разбираемся без\n                  войны платформ — и без обещаний, что один формат спасёт всё.\n                "
              }
            </p>
            {"\n                "}
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
              {"\n                  Читать статью "}
              <Icon name="arrow-right" className="size-4" />
              {"\n                "}
            </span>
            {"\n              "}
          </div>
          {"\n            "}
        </a>
        {"\n            "}
        <a
          id="article-card-chat-platforms-russia"
          href="/articles/chat-platforms-russia"
          className="group mt-5 grid overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 transition hover:border-amber-300 lg:grid-cols-[0.9fr_1.1fr]"
        >
          {"\n              "}
          <img
            src="/images/article-krovatka-history.png"
            alt="Архивный скриншот чата «Кроватка»"
            className="h-full min-h-64 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          {"\n              "}
          <div className="p-7 sm:p-9">
            {"\n                "}
            <p className="text-sm font-semibold text-amber-300">{"История Рунета"}</p>
            {"\n                "}
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {"\n                  От «Кроватки» до Telegram: как менялись чаты в России\n                "}
            </h2>
            {"\n                "}
            <p className="mt-4 leading-7 text-zinc-300">
              {
                "\n                  IRC и дозвон, общие комнаты, «аська», чатовые движки, соцсети и мессенджеры:\n                  вспоминаем без глянцевой ностальгии.\n                "
              }
            </p>
            {"\n                "}
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
              {"\n                  Читать статью "}
              <Icon name="arrow-right" className="size-4" />
              {"\n                "}
            </span>
            {"\n              "}
          </div>
          {"\n            "}
        </a>
        {"\n            "}
        <a
          id="article-card-how-vertigo-chat-works"
          href="/articles/how-vertigo-chat-works"
          className="group mt-5 block rounded-3xl border border-zinc-700 bg-zinc-900 p-7 transition hover:border-amber-300 hover:bg-zinc-900/80 sm:p-9"
        >
          {"\n              "}
          <p className="text-sm font-semibold text-amber-300">{"Как это устроено"}</p>
          {"\n              "}
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {"\n                Как устроен Vertigo: сообщения, приват и пароли\n              "}
          </h2>
          {"\n              "}
          <p className="mt-4 max-w-2xl leading-7 text-zinc-300">
            {
              "\n                Честно и без технического тумана: что попадает в историю, что проходит только\n                между двумя открытыми окнами и почему в базе нет паролей в открытом виде.\n              "
            }
          </p>
          {"\n              "}
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
            {"\n                Читать статью "}
            <Icon name="arrow-right" className="size-4" />
            {"\n              "}
          </span>
          {"\n            "}
        </a>
        {"\n          "}
      </section>
      {"\n        "}
    </section>
  )
}
