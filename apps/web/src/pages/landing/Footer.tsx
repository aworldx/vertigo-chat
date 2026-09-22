import { Icon } from "../../shared/ui/Icon"

export function Footer({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <>
      <section className="landing-finale" aria-labelledby="landing-finale-title">
        <span className="vertigo-mark" aria-hidden="true"></span>
        <p className="landing-eyebrow">Продолжение — с твоим участием</p>
        <h2 id="landing-finale-title">Следующая реплика — твоя.</h2>
        <p>Придумай ник. Сохрани свою историю. Найди своих.</p>
        <a id="landing-register-bottom" href="#landing-login" onClick={onRegister} className="landing-button">
          Зарегистрироваться <Icon name="arrow-right" className="size-4" />
        </a>
        <a href="#landing-login" onClick={onLogin} className="landing-finale-guest">
          Или сначала зайти гостем
        </a>
      </section>

      <footer className="landing-footer">
        <a href="/" className="landing-brand" aria-label="Vertigo — главная">
          <span className="vertigo-wordmark">Vertigo</span>
        </a>
        <p>Место для людей и их историй.</p>
        <a href="/help" className="landing-nav-link">
          Помощь
        </a>
      </footer>
    </>
  )
}
