import { Icon } from "../../../shared/ui/Icon";
export function ArticlesIndex() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
        Vertigo пишет
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-balance sm:text-6xl">
        {"Общие комнаты, история чатов и устройство Vertigo"}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
        {
          "Как выбрать формат разговора, что сохранилось от старых веб-чатов и чем публичная история отличается от привата и записок."
        }
      </p>
      <section
        className="mt-12 max-w-4xl"
        aria-labelledby="latest-articles-title"
      >
        <h2 id="latest-articles-title" className="sr-only">
          Последние статьи
        </h2>
        <a
          id="article-card-chats-vs-messengers"
          href="/articles/chats-vs-messengers"
          className="group grid overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 transition hover:border-amber-300 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <img
            src="/images/article-vertigo-room.png"
            width={1440}
            height={900}
            alt="Демонстрационная беседа в Vertigo"
            className="h-full w-full object-contain"
          />
          <div className="p-7 sm:p-9">
            <p className="text-sm font-semibold text-amber-300">{"Общение"}</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {"Общая комната или мессенджер: куда идти с разговором"}
            </h2>
            <p className="mt-4 leading-7 text-zinc-300">
              {
                "Три конкретных сценария: спросить у знакомого, найти собеседников по теме и вернуться к разговору позже. Разбираем их на примере Vertigo и групп Telegram."
              }
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
              Читать статью <Icon name="arrow-right" className="size-4" />
            </span>
          </div>
        </a>
        <a
          id="article-card-chat-platforms-russia"
          href="/articles/chat-platforms-russia"
          className="group mt-5 grid overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 transition hover:border-amber-300 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <img
            src="/images/article-august-nightcats.jpg"
            width={400}
            height={226}
            style={{
              width: 400,
              maxWidth: "100%",
              height: "auto",
              alignSelf: "center",
              justifySelf: "center",
            }}
            alt="Архивное оформление чата August4u"
            className="h-full w-full object-contain"
          />
          <div className="p-7 sm:p-9">
            <p className="text-sm font-semibold text-amber-300">
              {"История чатов"}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {"От «Кроватки» и ICQ до Telegram: как менялись чаты"}
            </h2>
            <p className="mt-4 leading-7 text-zinc-300">
              {
                "Комнаты «Кроватки», чатовые движки, ICQ, социальные сети и группы Telegram: выборочная история по документам и свидетельствам участников."
              }
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
              Читать статью <Icon name="arrow-right" className="size-4" />
            </span>
          </div>
        </a>
        <a
          id="article-card-how-vertigo-chat-works"
          href="/articles/how-vertigo-chat-works"
          className="group mt-5 block rounded-3xl border border-zinc-700 bg-zinc-900 p-7 transition hover:border-amber-300 hover:bg-zinc-900/80 sm:p-9"
        >
          <p className="text-sm font-semibold text-amber-300">
            {"Как это устроено"}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {"Что Vertigo сохраняет: история, приват и офлайн-записки"}
          </h2>
          <p className="mt-4 leading-7 text-zinc-300">
            {
              "Где найти вчерашний разговор, почему приват не восстановится после перезагрузки и какие сообщения остаются на сервере."
            }
          </p>
          <span className="mt-6 inline-flex items-center gap-2 font-semibold text-amber-200">
            Читать статью <Icon name="arrow-right" className="size-4" />
          </span>
        </a>
      </section>
    </section>
  );
}
