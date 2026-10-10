export function ChatsArticle() {
  return (
    <article id="article-chats-vs-messengers" className="pb-20">
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        <a
          href="/articles"
          className="text-sm font-semibold text-amber-200 transition hover:text-amber-100"
        >
          ← Все статьи
        </a>
        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          {"Общение"}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-6xl">
          {"Общая комната или мессенджер: куда идти с разговором"}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-300 sm:text-2xl">
          {
            "«Пришли адрес», «кто смотрел этот фильм?» и «что вы вчера обсуждали?» — три разных задачи. Сравним, как их решают личная переписка, группа и общая комната Vertigo."
          }
        </p>
        <p className="mt-7 text-sm text-zinc-500">
          {"Обновлено 10 октября 2026 · 4 минуты чтения"}
        </p>
      </header>
      <figure className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
        <a
          href="/images/article-vertigo-room.png"
          aria-label="Открыть скриншот в полном размере"
        >
          <img
            src="/images/article-vertigo-room.png"
            width={1440}
            height={900}
            alt="Общая комната Vertigo: демонстрационная беседа Лизы и Ильи"
            className="h-auto w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
          />
        </a>
        <figcaption className="mt-3 text-sm text-zinc-500">
          {
            "Общая комната Vertigo: лента разговора, список присутствующих и поле сообщения. Демонстрационные участники и реплики, октябрь 2026. Нажми на снимок, чтобы открыть полный размер."
          }
        </figcaption>
      </figure>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <p className="font-bold text-zinc-100">О чём статья</p>
          <ol className="mt-3 space-y-2 text-zinc-300 marker:text-amber-300">
            <li>
              <a
                href="#different-jobs"
                className="transition hover:text-amber-200"
              >
                {"Сначала задача, потом приложение"}
              </a>
            </li>
            <li>
              <a
                href="#chat-strengths"
                className="transition hover:text-amber-200"
              >
                {"Как начать в Vertigo"}
              </a>
            </li>
            <li>
              <a href="#later" className="transition hover:text-amber-200">
                {"Когда собеседник ушёл"}
              </a>
            </li>
            <li>
              <a
                href="#chat-weaknesses"
                className="transition hover:text-amber-200"
              >
                {"Когда лучше выбрать другой формат"}
              </a>
            </li>
          </ol>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="different-jobs"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Сначала задача, потом приложение"}
          </h2>
          <p>
            {
              "Если нужно отправить другу адрес встречи, проще написать ему лично: адресат уже известен, ответ можно прочитать позже. Когда хочется обсудить фильм с теми, кто его видел, важнее собрать несколько собеседников. Для этого подходит и отдельный веб-чат, и группа внутри мессенджера."
            }
          </p>
          <p>
            {
              "Telegram нельзя свести к переписке со знакомыми: в нём есть публичные группы, ответы на сообщения, упоминания и инструменты модерации. Поэтому полезное сравнение проходит между способами разговора, а не между логотипами приложений. Возможности групп описаны в "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://telegram.org/tour/groups"
            >
              {"официальном обзоре Telegram"}
            </a>
            {"."}
          </p>
          <p>
            {
              "В общей комнате Vertigo отправная точка — люди, которые сейчас подключены. Можно войти гостем, прочитать последние сообщения и обратиться ко всей комнате. Это подходит для разговора в моменте, но не обещает, что нужный человек прямо сейчас онлайн или обязательно ответит."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="chat-strengths"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Как начать в Vertigo"}
          </h2>
          <p>
            {
              "После входа сначала посмотри на ленту и список чатлан. Вопрос с контекстом обычно удобнее для ответа: например, «Ищу короткий детектив на вечер, без жестоких сцен — что посоветуете?» Другим не приходится угадывать, о чём хочется поговорить."
            }
          </p>
          <p>
            {
              "Обычная реплика видна комнате и сохраняется в публичной истории. Если вопрос предназначен одному человеку, дважды нажми на его ник в списке чатлан или введи "
            }
            <code className="rounded bg-zinc-800 px-1">
              {"^Ник, текст сообщения"}
            </code>
            {
              ". Это приват: адресат должен быть в сети. Не путай его с обычным обращением по имени в публичной реплике."
            }
          </p>
          <p>
            {"Для разговора необязательно придумывать новую тему. Команда "}
            <code className="rounded bg-zinc-800 px-1">{"/музыка Кино"}</code>
            {
              " открывает поиск: прослушивание результата сначала доступно только тебе, а самолётик отправляет трек в общий чат. Это позволяет предложить конкретную песню, не включая её автоматически всем участникам. Точные действия собраны в "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="/help#help-topic-music"
            >
              {"справке"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="later"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Когда собеседник ушёл"}
          </h2>
          <p>
            {
              "Онлайн-приват не превращается в письмо: сервер не оставляет его в очереди для отсутствующего человека. Для зарегистрированных участников есть отдельные «Записки». Выбери зарегистрированный ник и оставь текст — адресат увидит записку после следующего входа на сайт. Записка сохраняется, в отличие от привата."
            }
          </p>
          <p>
            {
              "Чтобы вернуться к публичному обсуждению, открой «О чате → История сообщений». Там можно выбрать период и отфильтровать реплики по автору или адресату публичного обращения. Доступны три календарных месяца; это не бессрочный архив. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="/help#help-topic-history"
            >
              {"Подробнее об истории"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="chat-weaknesses"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Когда лучше выбрать другой формат"}
          </h2>
          <p>
            {
              "Для точной договорённости с конкретным человеком полезен канал, который вы оба регулярно проверяете. Если нужен документ, к которому будут обращаться через год, сохрани результат разговора отдельно: срок хранения истории Vertigo ограничен. Для большого сообщества с разными темами имеет смысл сравнить способы организации обсуждений и модерации, а не только внешний вид окна."
            }
          </p>
          <p>
            {
              "Общая комната удобна, когда хочется присоединиться к текущему разговору. Её ценность определяется участниками и тем, как они общаются. Количество функций само по себе не делает сообщество дружелюбным, а открытый вход не гарантирует приватность: публичная реплика остаётся публичной."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <aside className="mt-14 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-7 sm:p-9">
          <h2 className="text-2xl font-bold text-zinc-100">
            {"Посмотреть общую комнату"}
          </h2>
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {
              "На главной можно выбрать гостевой вход или войти под зарегистрированным ником. Сначала прочитай несколько сообщений — этого достаточно, чтобы понять настроение комнаты."
            }
          </p>
          <a
            id="chats-enter-chat"
            href="/"
            className="mt-6 inline-flex rounded-lg bg-amber-300 px-5 py-3 font-bold text-zinc-950 transition hover:bg-amber-200"
          >
            {"Открыть Vertigo"}
          </a>
        </aside>
      </div>
    </article>
  );
}
