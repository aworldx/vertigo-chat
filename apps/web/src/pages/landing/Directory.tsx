import { Icon } from "../../shared/ui/Icon"

export function Directory() {
  return (
    <>
      <section id="landing-sections" className="landing-sections" aria-labelledby="landing-sections-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">Не только разговоры</p>
            <h2 id="landing-sections-title">
              Много поводов
              <br />
              вернуться.
            </h2>
          </div>
          <p className="landing-section-description">
            Один чат, разные увлечения.
            <br />
            Выбирай, с чего начнётся твой вечер.
          </p>
        </div>

        <div className="landing-feature-grid">
          <a id="landing-section-chat" href="#landing-login" className="landing-feature landing-feature-chat">
            <div className="landing-feature-top">
              <span className="landing-section-number">01 / Общение</span>
              <Icon name="arrow-up-right" className="size-5" />
            </div>
            <h3>Разговор без сценария</h3>
            <p>
              Общая комната, личные сообщения и новые знакомые. Обсуди день, найди свою компанию или просто скажи
              «привет».
            </p>
            <div className="landing-chat-lines" aria-hidden="true">
              <span>
                <i></i> С чего начнём?
              </span>
              <span>С хорошей компании.</span>
            </div>
            <span className="landing-feature-link">
              Войти в чат
              <Icon name="arrow-right" className="size-4" />
            </span>
          </a>
          <article id="landing-section-games" className="landing-feature landing-feature-games">
            <div className="landing-feature-top">
              <span className="landing-section-number">02 / Игры</span>
              <Icon name="puzzle-piece" className="size-5" />
            </div>
            <h3>Есть кому бросить вызов</h3>
            <p>Собирай игровой стол, приглашай соперника и меняй разговор на партию. А после — обсудите реванш.</p>
            <div className="landing-game-links">
              <a href="/checkers">Шашки</a>
              <a href="/games/battleship">Морской бой</a>
              <a href="/games/durak">Дурак</a>
              <a href="/games/balda">Балда</a>
            </div>
            <a id="landing-open-games" href="/games" className="landing-feature-link">
              Выбрать игру
              <Icon name="arrow-right" className="size-4" />
            </a>
          </article>
        </div>

        <div className="landing-directory">
          <a id="landing-section-profiles" href="/profiles" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">03</span>
              <Icon name="user-circle" className="size-6" />
            </div>
            <h3>Анкеты</h3>
            <p>Узнай, кто скрывается за ником. Загляни в профили чатлан и найди общие интересы.</p>
            <span className="landing-feature-link">
              Познакомиться ближе
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-library" href="/library" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">04</span>
              <Icon name="book-open" className="size-6" />
            </div>
            <h3>Библиотека</h3>
            <p>Авторские статьи и серии от участников. Читай чужие истории — и со временем расскажи свою.</p>
            <span className="landing-feature-link">
              Найти, что почитать
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-gallery" href="/gallery" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">05</span>
              <Icon name="photo" className="size-6" />
            </div>
            <h3>Фотоальбом</h3>
            <p>Моменты, которыми хочется поделиться. Смотри фотографии и открывай мир глазами других.</p>
            <span className="landing-feature-link">
              Заглянуть в альбом
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-music-chart" href="/music-chart" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">06</span>
              <Icon name="musical-note" className="size-6" />
            </div>
            <h3>Хит-парад</h3>
            <p>Загружай любимые треки, слушай музыку чатлан и поднимай лучшие в общий топ.</p>
            <span className="landing-feature-link">
              Открыть хит-парад
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-visits" href="/visits" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">07</span>
              <Icon name="clock" className="size-6" />
            </div>
            <h3>Кто был</h3>
            <p>Разминулись? Посмотри, кто и когда заходил в чат, и узнавай знакомые ники в истории визитов.</p>
            <span className="landing-feature-link">
              Посмотреть визиты
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-articles" href="/articles" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">08</span>
              <Icon name="newspaper" className="size-6" />
            </div>
            <h3>О чате</h3>
            <p>
              История онлайн-общения, чаты и мессенджеры, устройство Vertigo. Для тех, кому любопытно, как всё
              начиналось и работает.
            </p>
            <span className="landing-feature-link">
              Читать статьи
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
          <a id="landing-section-help" href="/help" className="landing-directory-item">
            <div className="landing-feature-top">
              <span className="landing-section-number">09</span>
              <Icon name="ticket" className="size-6" />
            </div>
            <h3>Помощь и звания</h3>
            <p>
              Команды, возможности и путь от зрителя до режиссёра. Узнай, как освоиться и что откроет следующее звание.
            </p>
            <span className="landing-feature-link">
              Разобраться в деталях
              <Icon name="arrow-up-right" className="size-4" />
            </span>
          </a>
        </div>
      </section>
    </>
  )
}
