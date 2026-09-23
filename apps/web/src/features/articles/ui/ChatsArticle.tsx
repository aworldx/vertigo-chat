export function ChatsArticle() {
  return (
    <article id="article-chats-vs-messengers" className="pb-20">
      {"\n          "}
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        {"\n            "}
        <a href="/articles" className="text-sm font-semibold text-amber-200 transition hover:text-amber-100">
          {"\n              ← Все статьи\n            "}
        </a>
        {"\n            "}
        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          {"\n              Общение\n            "}
        </p>
        {"\n            "}
        <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-6xl">
          {"\n              Зачем нужны чаты, когда есть Telegram и соцсети\n            "}
        </h1>
        {"\n            "}
        <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-300 sm:text-2xl">
          {
            "\n              Потому что сообщение «кто тоже не спит?» иногда ценнее ещё одного аккуратно\n              отредактированного поста.\n            "
          }
        </p>
        {"\n            "}
        <p className="mt-7 text-sm text-zinc-500">{"6 сентября 2026 · 6 минут чтения"}</p>
        {"\n          "}
      </header>
      {"\n\n          "}
      <figure className="mx-auto max-w-6xl px-5 sm:px-8">
        {"\n            "}
        <img
          src="/images/article-chat-window.png"
          alt="Скриншот переписки в Telegram Desktop"
          className="w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
        />
        {"\n            "}
        <figcaption className="mt-3 text-sm text-zinc-500">
          {"\n              Telegram Desktop, 2017. Скриншот: Huezohuezo1990, "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Telegram_Desktop_Tema.png"
            className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-200"
          >
            {"\n                CC BY-SA 4.0\n              "}
          </a>
          {".\n            "}
        </figcaption>
        {"\n          "}
      </figure>
      {"\n\n          "}
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        {"\n            "}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          {"\n              "}
          <p className="font-bold text-zinc-100">{"О чём речь"}</p>
          {"\n              "}
          <ol className="mt-3 space-y-2 text-zinc-300 marker:text-amber-300">
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#different-jobs" className="transition hover:text-amber-200">
                {"У каждого формата — своя работа"}
              </a>
              {"\n                "}
            </li>
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#chat-strengths" className="transition hover:text-amber-200">
                {"Что у общего чата получается лучше"}
              </a>
              {"\n                "}
            </li>
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#chat-weaknesses" className="transition hover:text-amber-200">
                {"Где чат честно проигрывает"}
              </a>
              {"\n                "}
            </li>
            {"\n              "}
          </ol>
          {"\n            "}
        </div>
        {"\n\n            "}
        <div className="mt-12 space-y-7 text-lg leading-8 text-zinc-300">
          {"\n              "}
          <p>
            {
              "\n                У большинства из нас уже есть всё: пара мессенджеров, десяток каналов, лента,\n                где кто-то успел жениться, переехать и купить кофемашину, пока мы чистили зубы.\n                Кажется, ещё один чат в этой экосистеме — как ещё одна кружка на кухне. Симпатично,\n                но куда её ставить?\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                А потом случается обычный вечер. В личке все заняты, под постом разговор давно\n                превратился в обмен реакциями, а сказать хочется не что-то великое, а просто:\n                «Кто смотрел этот сериал? Там в третьей серии вообще нормально?» И оказывается,\n                что для таких вещей нужен не алгоритм и не идеальная витрина. Нужна комната, в\n                которой кто-то сейчас есть.\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="different-jobs" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                У каждого формата — своя работа\n              "}
          </h2>
          {"\n              "}
          <p>
            {"\n                Telegram и другие мессенджеры хороши, когда уже понятно, "}
            <em>{"кому"}</em>
            {
              " писать.\n                Это быстрый коридор между знакомыми людьми: договориться о встрече, отправить\n                голосовое, не потерять адрес. Там не нужно разогреваться — вас уже знают.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                Соцсети устроены иначе. Они похожи на площадь с подсветкой: можно показать мысль,\n                фотографию, работу, получить отклик от большого круга. Но лента всё время торопит:\n                сегодня пост наверху, завтра его уже нет. В обсуждении легко набрать десятки\n                сердечек и так ни с кем толком не поговорить.\n              "
            }
          </p>
          {"\n            "}
        </div>
        {"\n          "}
      </div>
      {"\n\n          "}
      <figure className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
        {"\n            "}
        <img
          src="/images/article-social-feed.png"
          alt="Скриншот страницы входа в социальную сеть VK"
          className="w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
        />
        {"\n            "}
        <figcaption className="mt-3 text-sm text-zinc-500">
          {"\n              VK, 2026. Скриншот: Doofenshrburg, "}
          <a
            href="https://commons.wikimedia.org/wiki/File:VK%27s_home_page_(February_2026).png"
            className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-200"
          >
            {"\n                CC BY-SA 4.0\n              "}
          </a>
          {".\n            "}
        </figcaption>
        {"\n          "}
      </figure>
      {"\n\n          "}
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        {"\n            "}
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          {"\n              "}
          <p>
            {
              "\n                Общий чат — третий жанр. Здесь не надо быть автором, экспертом или близким другом.\n                Можно войти с короткого вопроса, подхватить чужую тему, исчезнуть на неделю и\n                вернуться без отчёта. Это не замена ни мессенджеру, ни соцсети. Скорее цифровая\n                гостиная: иногда там шумно, иногда пусто, но разговор принадлежит не одному\n                человеку и не ленте рекомендаций.\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="chat-strengths" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                Что у общего чата получается лучше\n              "}
          </h2>
          {"\n              "}
          <p>
            {"\n                "}
            <strong className="text-zinc-100">{"Снижать порог входа."}</strong>
            {
              " В личной переписке\n                первое сообщение почти всегда звучит как маленькое собеседование. В общем чате\n                можно обратиться сразу к теме, а не к человеку: попросить совет, поспорить о\n                фильме, показать смешную находку. Знакомство случается потом — если случается.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {"\n                "}
            <strong className="text-zinc-100">{"Давать случайности шанс."}</strong>
            {
              " Алгоритмы учатся\n                предсказывать наши привычки. Чат, наоборот, иногда сталкивает с тем, что вы бы\n                сами не выбрали: чужой профессией, книгой из детства, точкой зрения, от которой\n                хочется закатить глаза — а через пять минут уже интересно слушать.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {"\n                "}
            <strong className="text-zinc-100">{"Держать общий ритм."}</strong>
            {
              " У хорошего чата есть\n                память не только в истории сообщений. Она в повторяющихся шутках, в людях, которые\n                появляются по вечерам, в вопросе «как там твоя собака?» через месяц после случайного\n                рассказа. Так и возникает сообщество — не из подписок, а из маленькой привычки быть\n                рядом.\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="chat-weaknesses" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                Где чат честно проигрывает\n              "}
          </h2>
          {"\n              "}
          <p>
            {
              "\n                Чат не обязан быть удобным для всего. В нём быстро тонут длинные инструкции,\n                важные ссылки и сообщения, к которым нужно вернуться через полгода. Для этого\n                лучше подходят заметки, каналы, почта и нормально устроенные базы знаний.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                Ещё чат требует ухода. Без модерации живой разговор легко превращается в шумный\n                перекрёсток, где громче всех не обязательно интереснее всех. А открытость — это\n                не только возможность встретить «своих», но и шанс наткнуться на грубость или\n                странность. Хорошие правила здесь не портят атмосферу; они делают её возможной.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                И, конечно, не каждый вечер должен быть социальным. Иногда лучший формат —\n                выключить уведомления, отправить другу одно точное сообщение и уйти гулять. Чат\n                не должен побеждать остальные способы общения. Ему достаточно быть местом, куда\n                можно прийти, когда хочется разговора без повестки и без роли.\n              "
            }
          </p>
          {"\n              "}
          <p className="border-l-2 border-amber-300 pl-5 text-xl font-medium text-zinc-100">
            {
              "\n                Мессенджер отвечает на вопрос «кому написать». Соцсеть — «что показать». А чат\n                оставляет место для вопроса «кто сейчас хочет поговорить?»\n              "
            }
          </p>
          {"\n            "}
        </div>
        {"\n\n            "}
        <aside className="mt-14 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-7 sm:p-9">
          {"\n              "}
          <h2 className="text-2xl font-bold text-zinc-100">{"Хочется проверить на практике?"}</h2>
          {"\n              "}
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {
              "\n                В Vertigo можно зайти в общий разговор, поиграть в компании или просто посмотреть,\n                о чём сегодня говорят люди.\n              "
            }
          </p>
          {"\n              "}
          <a
            id="article-enter-chat"
            href="/"
            className="mt-6 inline-flex rounded-lg bg-amber-300 px-5 py-3 font-bold text-zinc-950 transition hover:bg-amber-200"
          >
            {"\n                Перейти в чат\n              "}
          </a>
          {"\n            "}
        </aside>
        {"\n          "}
      </div>
      {"\n        "}
    </article>
  )
}
