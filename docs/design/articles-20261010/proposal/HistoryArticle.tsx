export function HistoryArticle() {
  return (
    <article id="article-chat-platforms-russia" className="pb-20">
      <header className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        <a
          href="/articles"
          className="text-sm font-semibold text-amber-200 transition hover:text-amber-100"
        >
          ← Все статьи
        </a>
        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          {"История чатов"}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-6xl">
          {"От «Кроватки» и ICQ до Telegram: как менялись чаты"}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-300 sm:text-2xl">
          {
            "Комната на сайте, контакт в ICQ, профиль в соцсети и группа в Telegram предлагают разные способы начать разговор. Проследим несколько линий этой истории по документам и свидетельствам участников — без претензии на полный каталог Рунета."
          }
        </p>
        <p className="mt-7 text-sm text-zinc-500">
          {"Обновлено 10 октября 2026 · 6 минут чтения"}
        </p>
      </header>
      <figure
        className="mx-auto mt-12 max-w-6xl px-5 sm:px-8"
        style={{ maxWidth: 464 }}
      >
        <a
          href="/images/article-august-nightcats.jpg"
          aria-label="Открыть скриншот в полном размере"
        >
          <img
            src="/images/article-august-nightcats.jpg"
            width={400}
            height={226}
            alt="NightCats: лента сообщений и список участников чата «Женские Тайны» на August4u"
            className="h-auto w-full rounded-3xl border border-zinc-700 shadow-2xl shadow-black/30"
          />
        </a>
        <figcaption className="mt-3 text-sm text-zinc-500">
          NightCats — вариант оформления чата «Женские Тайны» на August4u.
          Изображение из{" "}
          <a
            href="https://www.secret4u.ru/des.htm"
            className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
          >
            архива владельцев
          </a>
          ; в описании дизайн датирован 2011 годом. Нажми на снимок, чтобы
          открыть оригинал.
        </figcaption>
      </figure>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <p className="font-bold text-zinc-100">О чём статья</p>
          <ol className="mt-3 space-y-2 text-zinc-300 marker:text-amber-300">
            <li>
              <a
                href="#first-rooms"
                className="transition hover:text-amber-200"
              >
                {"IRC: комната описана в протоколе"}
              </a>
            </li>
            <li>
              <a href="#krovatka" className="transition hover:text-amber-200">
                {"«Кроватка»: разговор в комнате"}
              </a>
            </li>
            <li>
              <a href="#engines" className="transition hover:text-amber-200">
                {"Веб-чат как собственное место"}
              </a>
            </li>
            <li>
              <a href="#borodin" className="transition hover:text-amber-200">
                {"Чат Бородина: движок и сообщество — разные вещи"}
              </a>
            </li>
            <li>
              <a href="#icq" className="transition hover:text-amber-200">
                {"ICQ и Агент: собеседник в списке контактов"}
              </a>
            </li>
            <li>
              <a
                href="#social-networks"
                className="transition hover:text-amber-200"
              >
                {"Соцсети: контекст вокруг человека"}
              </a>
            </li>
            <li>
              <a href="#messengers" className="transition hover:text-amber-200">
                {"Личная переписка и общая группа сосуществуют"}
              </a>
            </li>
            <li>
              <a href="#today" className="transition hover:text-amber-200">
                {"Что сохранил Vertigo"}
              </a>
            </li>
          </ol>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="first-rooms"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"IRC: комната описана в протоколе"}
          </h2>
          <p>
            {
              "В мае 1993 года опубликован RFC 1459 — описание Internet Relay Chat. В нём уже есть ники, каналы, операторы каналов и сообщения одному собеседнику. Документ различает разговор один на один и передачу сообщения группе. Это полезная точка отсчёта: привычные элементы чата можно увидеть в техническом документе, а не только вспомнить по старым скриншотам."
            }
          </p>
          <p>
            {
              "Канал объединяет людей вокруг одного разговора. Оператор управляет каналом; приват адресован конкретному участнику. При этом IRC — протокол взаимодействия клиентов и серверов, а не единственный сайт с одной аудиторией. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://www.rfc-editor.org/rfc/rfc1459.html"
            >
              {"Первоисточник: RFC 1459"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="krovatka"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"«Кроватка»: разговор в комнате"}
          </h2>
          <p>
            {
              "«Кроватка» показывает другую сторону истории — конкретное сообщество, а не протокол. Андрей Куля, участник команды проекта, вспоминал, что людей привлекал немедленный отклик: написал в комнату и получил ответ. Его свидетельство опубликовано в интервью «Секрету фирмы»; фрагмент интервью сохранился в "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://daily.afisha.ru/culture/2550-interesnye-stati/"
            >
              {"подборке «Афиши» от 14 августа 2016 года"}
            </a>
            {"."}
          </p>
          <p>
            {
              "В этом рассказе важна сама привычка возвращаться к разговору и знакомым никам. Она объясняет, почему старый чат вспоминают как место встреч, а не как набор кнопок. Темы могли меняться, но узнаваемые ники помогали продолжать знакомство при следующем входе."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="engines"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Веб-чат как собственное место"}
          </h2>
          <p>
            {
              "В браузерных чатах знакомая схема получила заметное оформление: фон, цвета ников, отдельные области разговора и списка участников. У одной технологии могли быть разные сообщества и совершенно разный внешний вид. Поэтому название сервиса, название конкретной комнаты и название её оформления — разные вещи."
            }
          </p>
          <p>
            {
              "Хорошо сохранившийся пример — страница оформлений чата «Женские Тайны» на August4u. Её авторы показывают несколько вариантов интерфейса и отдельно объясняют их происхождение. Ранние оформления были утрачены и затем восстановлены; «Красный чат» они связывают со сбоем серверов в 2006 году. Историю этих изменений можно проследить по подписям владельцев к каждому оформлению."
            }
          </p>
          <p>
            {
              "На странице есть и «Деловой чат», стилизованный под окно программы, и более декоративные варианты. По ним видно, что оформление было частью узнаваемости комнаты. При этом восстановленный дизайн нельзя автоматически считать точной копией исходного: сами авторы предупреждают о различиях. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://www.secret4u.ru/des.htm"
            >
              {"Архив оформлений «Женских Тайн»"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="borodin"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Чат Бородина: движок и сообщество — разные вещи"}
          </h2>
          <p>
            {
              "Чтобы открыть собственную комнату, не обязательно было писать весь чат заново. Например, владельцы «Никчата» в публикации от 27 сентября 2010 года прямо указывают, что используют движок Дмитрия Бородина, и описывают возможность установить такой же чат. Одинаковую программную основу могли использовать разные сайты со своими участниками. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://nik-chat.net/main/6-skachat-besplatno-chat-borodina.html"
            >
              {"Страница «Никчата» о движке"}
            </a>
            {"."}
          </p>
          <p>
            {
              "Различие практическое: движок задаёт возможности, а владельцы отдельного сайта — оформление, правила и круг участников. На той же странице теперь есть приглашение бывших посетителей в группу Telegram. Адрес комнаты меняется, но владельцы рассчитывают собрать тех же знакомых людей."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="icq"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"ICQ и Агент: собеседник в списке контактов"}
          </h2>
          <p>
            {
              "В личном мессенджере отправной точкой стал выбранный контакт. Встретившись в общей комнате, можно было продолжить разговор один на один; эти сценарии сосуществовали. ICQ не была российской разработкой, но занимала заметное место в русскоязычном общении."
            }
          </p>
          <p>
            {
              "В годовом отчёте Mail.Ru Group за 2010 год указаны основание ICQ в 1996-м и запуск Mail.Ru Агента в 2003-м. Там же описаны версии для компьютеров, мобильных устройств и браузера, голосовые и видеозвонки, передача файлов. Поэтому представлять мессенджер той эпохи исключительно как короткие текстовые сообщения было бы неточно. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://corp.vkcdn.ru/media/files/mail.rugroupar2010.pdf"
            >
              {"Отчёт Mail.Ru Group, страницы 12–13"}
            </a>
            {"."}
          </p>
          <p>
            {
              "Сегодня оригинальный сервис ICQ уже не работает — это подтверждает "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://icq.com/desktop/en"
            >
              {"его официальный сайт"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="social-networks"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Соцсети: контекст вокруг человека"}
          </h2>
          <p>
            {
              "Социальные сети объединили переписку с фотографиями, обновлениями статуса и другими сведениями о знакомых. Эти функции перечислены уже в отчёте Mail.Ru Group за 2010 год для «Одноклассников» и «Моего мира». Профиль давал повод начать разговор и позволял узнать о человеке что-то за пределами текущей реплики."
            }
          </p>
          <p>
            {
              "Это не означает, что все пользователи отказались от комнат или личных клиентов. Менялось сочетание действий в одном сервисе: прочитать обновление, посмотреть фотографию, ответить автору и перейти в переписку. Веб-чаты, мессенджеры и соцсети не образуют лестницу, на которой каждый новый формат полностью отменяет предыдущий."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="messengers"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Личная переписка и общая группа сосуществуют"}
          </h2>
          <p>
            {
              "Список контактов и общая комната решают разные задачи. В первом случае выбирают человека, во втором — присоединяются к разговору нескольких участников. Появление новых приложений не отменило этого различия: в одном сервисе могут одновременно существовать личные диалоги, группы и каналы."
            }
          </p>
          <p>
            {
              "Например, Telegram документирует публичные группы, ответы, упоминания, закреплённые сообщения и права администраторов. Поэтому современную группу вполне можно рассматривать как продолжение сценария общей комнаты. Участники по-прежнему обсуждают одну тему вместе, а ответы и упоминания помогают не потерять отдельную реплику в потоке. "
            }
            <a
              className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
              href="https://telegram.org/tour/groups"
            >
              {"Обзор групп Telegram"}
            </a>
            {"."}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-3xl px-5 sm:px-8">
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <h2
            id="today"
            className="text-3xl font-bold tracking-tight text-zinc-100"
          >
            {"Что сохранил Vertigo"}
          </h2>
          <p>
            {
              "В Vertigo остаются ник, общий разговор, список присутствующих и онлайн-приват. Современный интерфейс добавляет реакции, поиск музыки и видео, настройки оформления. Эти детали меняют удобство, но основное действие остаётся простым: войти в комнату и обратиться к людям, которые там сейчас есть."
            }
          </p>
        </div>
      </div>
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
        <div className="space-y-7 text-lg leading-8 text-zinc-300">
          <p>
            {
              "От IRC и веб-комнат до современных групп повторяются знакомые задачи: найти компанию, понять, кто онлайн, отделить публичную реплику от личной и договориться о правилах. Интерфейс помогает их решить, а повод вернуться создаёт сам разговор."
            }
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <aside className="mt-14 rounded-3xl border border-amber-300/35 bg-amber-300/10 p-7 sm:p-9">
          <h2 className="text-2xl font-bold text-zinc-100">
            {"Посмотреть современную комнату"}
          </h2>
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {
              "В Vertigo можно попробовать этот способ общения в браузере. А правила команд и ограничения функций собраны в справке."
            }
          </p>
          <a
            id="history-enter-chat"
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
