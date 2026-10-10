import { Icon } from "../../shared/ui/Icon"
import { landingContent } from "./content"

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
            <p>{landingContent.chat}</p>
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
            <h3>{landingContent.gamesTitle}</h3>
            <p>{landingContent.games}</p>
            <div className="landing-game-links">
              {landingContent.gameLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.text}
                </a>
              ))}
            </div>
            <a id="landing-open-games" href={landingContent.gamesAction.href} className="landing-feature-link">
              {landingContent.gamesAction.text}
              <Icon name="arrow-right" className="size-4" />
            </a>
          </article>
        </div>

        <div className="landing-directory">
          {landingContent.cards.map((card, index) => (
            <a key={card.id} id={`landing-section-${card.id}`} href={card.href} className="landing-directory-item">
              <div className="landing-feature-top">
                <span className="landing-section-number">{String(index + 3).padStart(2, "0")}</span>
                <Icon name={card.icon} className="size-6" />
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <span className="landing-feature-link">
                {card.action}
                <Icon name="arrow-up-right" className="size-4" />
              </span>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
