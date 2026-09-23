export function HistoryArticle() {
  return (
    <article id="article-chat-platforms-russia" className="pb-20">
      {"\n          "}
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        {"\n            "}
        <a href="/articles" className="text-sm font-semibold text-amber-200 transition hover:text-amber-100">
          {"\n              ← Все статьи\n            "}
        </a>
        {"\n            "}
        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          {"\n              История Рунета\n            "}
        </p>
        {"\n            "}
        <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-6xl">
          {"\n              От «Кроватки» до Telegram: как менялись чаты в России\n            "}
        </h1>
        {"\n            "}
        <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-300 sm:text-2xl">
          {
            "\n              Когда-то знакомились в комнате с названием «Основная», берегли короткий UIN и\n              ругались из-за флуда. Формы изменились — привычка искать живой разговор осталась.\n            "
          }
        </p>
        {"\n            "}
        <p className="mt-7 text-sm text-zinc-500">{"6 сентября 2026 · 8 минут чтения"}</p>
        {"\n          "}
      </header>
      {"\n\n          "}
      <figure className="mx-auto max-w-6xl px-5 sm:px-8">
        {"\n            "}
        <img
          src="/images/article-krovatka-history.png"
          alt="Архивный скриншот общей комнаты чата «Кроватка»"
          className="w-full rounded-3xl border border-zinc-700 bg-zinc-900 object-contain shadow-2xl shadow-black/30"
        />
        {"\n            "}
        <figcaption className="mt-3 text-sm text-zinc-500">
          {"\n              «Кроватка — Основная», архивный скриншот из материала "}
          <a
            href="https://pikabu.ru/story/webchatyi_2000kh_kakimi_zapomnili_ikh_myi_5963715"
            className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-200"
          >
            {"\n                «Веб-чаты 2000-х»\n              "}
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
          <p className="font-bold text-zinc-100">{"Маршрут статьи"}</p>
          {"\n              "}
          <ol className="mt-3 space-y-2 text-zinc-300 marker:text-amber-300">
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#first-rooms" className="transition hover:text-amber-200">
                {"Когда чат был местом, а не кнопкой"}
              </a>
              {"\n                "}
            </li>
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#engines" className="transition hover:text-amber-200">
                {"«Кроватка», Бородин и Август"}
              </a>
              {"\n                "}
            </li>
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#messengers" className="transition hover:text-amber-200">
                {"«Аська» и личный список контактов"}
              </a>
              {"\n                "}
            </li>
            {"\n                "}
            <li>
              {"\n                  "}
              <a href="#today" className="transition hover:text-amber-200">
                {"Что осталось в современных платформах"}
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
              "\n                У старого Рунета был очень конкретный звук: модем долго и сердито договаривался\n                с телефонной линией, а потом появлялась возможность зайти туда, где тебя никто\n                не ждал — и всё-таки мог ответить. До лент, подписок и рекомендаций оставались\n                годы. Чат не был вкладкой в большой экосистеме. Он и был местом встречи.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                Первыми для многих стали IRC-каналы и локальные сети: текст, ник, решётка перед\n                названием комнаты. В них было мало интерфейса и много неписаных правил. Когда\n                веб стал массовее, тот же азарт пересел в браузерные комнаты — туда можно было\n                зайти без особой технической подготовки и почти сразу услышать: «привет, ты откуда?»\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="first-rooms" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                Когда чат был местом, а не кнопкой\n              "}
          </h2>
          {"\n              "}
          <p>
            {
              "\n                В середине и конце девяностых чат часто выглядел как отдельный городок. У него\n                были главная комната, каналы по интересам, местные звёзды, модераторы и даже\n                собственный словарь. Неудивительно, что люди помнят названия, а не только\n                технологию: «Кроватка», «Диван Махаона», городские чаты провайдеров.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                «Кроватка» выросла из этой логики. Проект возник в 1996 году, а его запуск обычно\n                датируют 1997-м. Позже там появились тематические каналы, анкеты, личные сообщения,\n                игнор и правила — то есть почти весь набор привычной нам платформы, только в\n                прямоугольниках раннего веба. Сервис закрылся в 2020 году, но скриншоты легко\n                объясняют, почему о нём до сих пор говорят как о живом месте, а не просто о сайте.\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="engines" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                «Кроватка», Бородин и Август — это не одно и то же\n              "}
          </h2>
          {"\n              "}
          <p>
            {
              "\n                Здесь легко запутаться. «Кроватка» была большой публичной площадкой со своим\n                именем и культурой. А чат Бородина — скорее название популярного в нулевые\n                движка: его ставили на разные сайты, и у каждого такого чата была собственная\n                аудитория. Поэтому «чат Бородина» многие помнят как тип интерфейса — с общей\n                комнатой, приватами и отдельным серверным демоном, — а не как один адрес в сети.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                «Чат Августа» — ещё одна отдельная история: в Рунете так называли комнаты на\n                платном сервисе August4u. На сайте «Женские Тайны» до сих пор можно увидеть\n                несколько исторических оформлений: от раннего «звёздного» до дизайнов, восстановленных\n                после падения серверов в 2006 году. Это хороший след эпохи, когда внешний вид\n                чата можно было поменять буквально как обои в комнате.\n              "
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
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          {"\n              "}
          <h2 id="messengers" className="text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                «Аська» и личный список контактов\n              "}
          </h2>
          {"\n              "}
          <p>
            {
              "\n                В конце девяностых ICQ изменила привычку общения: вместо того чтобы прийти в\n                комнату к незнакомым людям, можно было увидеть, кто из своих сейчас онлайн. UIN\n                знали наизусть, короткие номера считались удачей, а характерное «о-оу» работало\n                лучше любого пуша. В России ICQ стала настолько массовой, что слово «аська»\n                оказалось понятнее, чем «мгновенные сообщения».\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                Нулевые развели два сценария. Общие веб-чаты оставались местом случайного\n                знакомства и ночных разговоров; ICQ, QIP и Mail.ru Агент сделали нормой личный\n                список контактов. Затем соцсети добавили профиль, фотографию и ленту. Разговор\n                перестал начинаться в пустой комнате: сначала тебя можно было рассмотреть.\n              "
            }
          </p>
          {"\n\n              "}
          <h2 id="today" className="pt-5 text-3xl font-bold tracking-tight text-zinc-100">
            {"\n                Что осталось в современных платформах\n              "}
          </h2>
          {"\n              "}
          <p>
            {
              "\n                В Telegram, VK и других сегодняшних сервисах живут почти все старые формы:\n                публичные каналы напоминают медиа, групповые чаты — комнаты, личка — ICQ, а\n                реакции и стикеры заменяют часть старого чатового языка. Изменился масштаб и\n                скорость, но не базовый вопрос: где найти разговор, в котором можно быть не\n                автором поста, а просто человеком среди людей.\n              "
            }
          </p>
          {"\n              "}
          <p>
            {
              "\n                Поэтому старые чаты не стоит описывать как нелепый пролог к «настоящему» интернету.\n                Они придумали многое из того, что мы сейчас считаем обычным: ники, статусы,\n                каналы, модерацию, приват, чёрные списки и странное, но важное право просто\n                зайти, поздороваться и посмотреть, кто сегодня не спит.\n              "
            }
          </p>
          {"\n            "}
        </div>
        {"\n\n            "}
        <figure className="mt-12">
          {"\n              "}
          <img
            src="/images/article-social-feed.png"
            alt="Скриншот страницы входа в социальную сеть VK"
            className="w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
          />
          {"\n              "}
          <figcaption className="mt-3 text-sm text-zinc-500">
            {"\n                VK, 2026. Скриншот: Doofenshrburg, "}
            <a
              href="https://commons.wikimedia.org/wiki/File:VK%27s_home_page_(February_2026).png"
              className="underline decoration-zinc-600 underline-offset-2 transition hover:text-amber-200"
            >
              {"\n                  CC BY-SA 4.0\n                "}
            </a>
            {".\n              "}
          </figcaption>
          {"\n            "}
        </figure>
        {"\n\n            "}
        <aside className="mt-14 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-7 sm:p-9">
          {"\n              "}
          <h2 className="text-2xl font-bold text-zinc-100">{"Чат — не музейный экспонат"}</h2>
          {"\n              "}
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {
              "\n                Технологии сменились, а общая комната всё ещё нужна тем, кто хочет поговорить,\n                а не только оставить реакцию.\n              "
            }
          </p>
          {"\n              "}
          <a
            id="history-enter-chat"
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
