export function TechnologyArticle() {
  return (
    <article id="article-how-vertigo-chat-works" className="pb-20">
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        <a
          href="/articles"
          className="text-sm font-semibold text-amber-200 transition hover:text-amber-100"
        >
          ← Все статьи
        </a>
        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          {"Как это устроено"}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-6xl">
          {"Что Vertigo сохраняет: история, приват и офлайн-записки"}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-300 sm:text-2xl">
          {
            "У трёх похожих действий разный результат: написать в комнату, отправить приват человеку онлайн и оставить записку на потом. Вот где проходит граница хранения и кто увидит сообщение."
          }
        </p>
        <p className="mt-7 text-sm text-zinc-500">
          {"Обновлено 10 октября 2026 · 5 минут чтения"}
        </p>
      </header>
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <section
          aria-labelledby="message-route-title"
          className="rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl shadow-black/20 sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
            Короткая схема
          </p>
          <h2
            id="message-route-title"
            className="mt-3 text-2xl font-bold text-zinc-100"
          >
            Путь сообщения зависит от его типа
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
              <p className="font-bold text-emerald-200">Публичное сообщение</p>
              <p className="mt-2 leading-7 text-zinc-300">
                Браузер → Go → PostgreSQL → участники комнаты.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                При входе — последние 100 сообщений; в архиве — три календарных
                месяца.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-400/30 bg-sky-400/5 p-5">
              <p className="font-bold text-sky-200">Онлайн-приват</p>
              <p className="mt-2 leading-7 text-zinc-300">
                Браузер → Go WebSocket → отправитель и адресат.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Адресат должен быть онлайн; записи в истории комнаты нет.
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <p className="font-bold text-zinc-100">О чём статья</p>
          <ol className="mt-3 space-y-2 text-zinc-300 marker:text-amber-300">
            <li>
              <a href="#realtime" className="transition hover:text-amber-200">
                {"Как сообщение приходит в комнату"}
              </a>
            </li>
            <li>
              <a
                href="#public-history"
                className="transition hover:text-amber-200"
              >
                {"Как найти вчерашний разговор"}
              </a>
            </li>
            <li>
              <a href="#private" className="transition hover:text-amber-200">
                {"Приват: только пока адресат в сети"}
              </a>
            </li>
            <li>
              <a
                href="#notes-and-bot"
                className="transition hover:text-amber-200"
              >
                {"Записки и бот — другие режимы"}
              </a>
            </li>
            <li>
              <a href="#passwords" className="transition hover:text-amber-200">
                {"Что происходит с паролем"}
              </a>
            </li>
            <li>
              <a href="#limits" className="transition hover:text-amber-200">
                {"Короткая проверка перед отправкой"}
              </a>
            </li>
          </ol>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="realtime"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Как сообщение приходит в комнату"}
          </h2>
          <p>
            {
              "React-интерфейс держит WebSocket-соединение с Go-сервером. Поэтому новые реплики приходят в открытую вкладку без ручного обновления страницы. Сервер проверяет сессию и команду, а публичное сообщение сохраняет в PostgreSQL и передаёт подключённым участникам."
            }
          </p>
          <p>
            {
              "Список чатлан отражает текущие подключения, а не весь список зарегистрированных пользователей. При потере связи состояние присутствия меняется. Наличие ника в списке не обещает немедленного ответа: человек мог отойти от устройства."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="public-history"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Как найти вчерашний разговор"}
          </h2>
          <p>
            {
              "При входе в комнату загружаются последние 100 сообщений. Это размер начальной ленты, а не предел всего архива. Более ранние публичные реплики доступны в разделе «О чате → История сообщений» за последние три календарных месяца."
            }
          </p>
          <p>
            {
              "Выбери период в полях «С» и «По» и нажми «Показать историю». Есть быстрые варианты «Последний час», «Сегодня», «Вчера». Время московское, независимо от настроек устройства; выбранная последняя минута включается целиком. Кнопка «Следующие 100» открывает следующую страницу результатов."
            }
          </p>
          <p>
            {
              "Фильтр «Фразы от кого» принимает полный ник автора, «Фразы кому» — адресата публичного обращения. Регистр не важен. Это не поиск любого упоминания имени внутри текста: фильтр использует сохранённого адресата реплики. Можно заполнить оба поля одновременно."
            }
          </p>
          <p>
            {
              "В архив попадают публичные сообщения и системные события, включая вход и выход. Приваты и персональные подсказки туда не записываются. При включённых фильтрах по никам системные события не показываются. Удалённые сообщения недоступны; AI-саммари истории сейчас отключено."
            }
          </p>
        </div>
      </div>
      <figure className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
        <a
          href="/images/article-vertigo-history.png"
          aria-label="Открыть скриншот в полном размере"
        >
          <img
            src="/images/article-vertigo-history.png"
            width={896}
            height={646}
            alt="История Vertigo: период и фильтры «Фразы от кого» и «Фразы кому»"
            className="h-auto w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
          />
        </a>
        <figcaption className="mt-3 text-sm text-zinc-500">
          {
            "История сообщений Vertigo: период по московскому времени и фильтры по полным никам. Демонстрационные сообщения, октябрь 2026. Нажми на снимок, чтобы открыть полный размер."
          }
        </figcaption>
      </figure>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300"></div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="private"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Приват: только пока адресат в сети"}
          </h2>
          <p>
            {"Дважды нажми на ник в списке чатлан или введи "}
            <code className="rounded bg-zinc-800 px-1">
              {"^Ник, текст сообщения"}
            </code>
            {
              ". Сервер находит активного адресата в комнате и передаёт реплику отправителю и получателю. В таблицу публичной истории она не записывается."
            }
          </p>
          <p>
            {
              "После перезагрузки страницы восстановить такой разговор из архива Vertigo нельзя. Если адресат недоступен, приват не становится отложенным письмом. Это доставка онлайн, а не постоянный личный диалог с серверной историей. Во время работы сервера реплика может временно оставаться в памяти для защиты от повторной отправки; пользовательского архива приватов из этого не создаётся."
            }
          </p>
          <p>
            {
              "Отсутствие архива не означает сквозное шифрование: содержимое проходит через сервер. Получатель также может скопировать текст или сделать снимок экрана. Обещание касается способа хранения в Vertigo, а не невозможности сохранить реплику где-либо ещё."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="notes-and-bot"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Записки и бот — другие режимы"}
          </h2>
          <p>
            {
              "Для сообщения человеку, который ушёл, предусмотрены «Записки» в верхнем меню. Они доступны зарегистрированным участникам, сохраняются на сервере и появляются у адресата после следующего входа. В общий чат записка не публикуется. Поэтому правило «приват не хранится» нельзя переносить на записки."
            }
          </p>
          <p>
            {
              "Разговор с Хичкоком тоже обрабатывается отдельно: обращения и ответы сохраняются в истории диалога бота, а контекст передаётся AI-сервису для подготовки следующего ответа. Не считай обращение к боту приватной перепиской между двумя людьми. Персональные подсказки Кармика по функциям видны автору вопроса и не добавляются в общую историю."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="passwords"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Что происходит с паролем"}
          </h2>
          <p>
            {
              "При регистрации пароль преобразуется в хэш PBKDF2-HMAC-SHA-256: используется случайная соль длиной 16 байт, 210 000 итераций и результат длиной 32 байта. В базе хранятся параметры, соль и результат вычисления, а не исходный пароль. При входе сервер вычисляет результат для введённого пароля и сравнивает его с сохранённым значением в постоянное время."
            }
          </p>
          <p>
            {
              "Это описание текущей реализации, а не гарантия неуязвимости. Хэширование не делает слабый пароль сильным. Для аккаунта полезен отдельный пароль, который не используется на других сайтах."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="limits"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Короткая проверка перед отправкой"}
          </h2>
          <p>
            {
              "Если реплику должна увидеть комната — отправляй обычное сообщение и учитывай публичную историю. Если человек онлайн и разговор личный — используй приват. Если зарегистрированный адресат вернётся позже — оставь записку и помни, что она сохраняется. Для действий и названий кнопок есть "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="/help"
            >
              {"справка"}
            </a>
            {
              "; сведения в этой статье проверены по реализации на 10 октября 2026 года."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <aside className="mt-14 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-7 sm:p-9">
          <h2 className="text-2xl font-bold text-zinc-100">
            {"Проверить нужную команду"}
          </h2>
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {
              "В справке есть отдельные темы про историю, приват и записки с точными действиями в интерфейсе."
            }
          </p>
          <a
            id="technology-enter-chat"
            href="/help"
            className="mt-6 inline-flex rounded-lg bg-amber-300 px-5 py-3 font-bold text-zinc-950 transition hover:bg-amber-200"
          >
            {"Открыть справку"}
          </a>
        </aside>
      </div>
    </article>
  );
}
