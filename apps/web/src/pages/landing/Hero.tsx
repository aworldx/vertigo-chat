import { Icon } from "../../shared/ui/Icon"

export function Hero() {
  return (
    <>
      <header className="landing-header landing-container">
        <a id="landing-logo" href="/" className="landing-brand" aria-label="Vertigo — главная">
          <span className="vertigo-mark" aria-hidden="true"></span>
          <span className="vertigo-wordmark">Vertigo</span>
        </a>
        <nav aria-label="Навигация по главной" className="flex items-center gap-6 sm:gap-9">
          <a href="#landing-sections" className="landing-nav-link hidden sm:inline">
            Что внутри
          </a>
          <a href="#landing-registration" className="landing-nav-link hidden md:inline">
            Зачем регистрироваться
          </a>
          <a id="landing-enter-chat-header" href="#landing-login" className="landing-header-login">
            Войти <Icon name="arrow-up-right" className="size-4" />
          </a>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <img
          id="landing-poster"
          src="/images/vertigo-poster.png"
          width="1564"
          height="915"
          alt=""
          fetchPriority="high"
          className="landing-poster"
        />
        <div className="landing-container relative z-10">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span aria-hidden="true"></span> Чат с характером
            </p>
            <h1 id="landing-title">
              У каждого
              <br />
              своя <em>история.</em>
            </h1>
            <p className="landing-hero-description">
              Иногда всё начинается с простого «привет».
              <br className="hidden sm:block" />
              Знакомься, играй, делись своим —<br className="hidden sm:block" />и становись частью Vertigo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a id="landing-enter-chat" href="#landing-login" className="landing-button">
                Присоединиться <Icon name="arrow-right" className="size-4" />
              </a>
              <a href="#landing-sections" className="landing-text-link">
                Осмотреться <Icon name="arrow-down" className="size-4" />
              </a>
            </div>
            <p className="landing-hero-note">Можно просто выбрать ник и войти гостем</p>
          </div>
        </div>
        <div className="landing-hero-caption" aria-hidden="true">
          Общение. Игры. Неожиданные знакомства.
        </div>
      </section>
    </>
  )
}
