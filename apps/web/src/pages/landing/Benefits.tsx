import { Icon } from "../../shared/ui/Icon"

export function Benefits({ onRegister }: { onRegister: () => void }) {
  return (
    <>
      <div className="landing-benefits">
        <p className="landing-eyebrow">Твоя роль начинается здесь</p>
        <h2 id="landing-registration-title">
          Никаких анкет на входе.
          <br />
          Ник и пароль — для старта.
        </h2>
        <p className="landing-section-description">
          Для регистрации не нужны настоящее имя и телефон. Почта необязательна для чата и нужна только для форума —
          другим участникам её не показываем.
        </p>
        <ul className="landing-benefit-list">
          <li>
            <Icon name="finger-print" className="size-5 shrink-0" />
            <div>
              <strong>Ник, который принадлежит тебе</strong>
              <p>Возвращайся под своим именем — другой гость его не займёт.</p>
            </div>
          </li>
          <li>
            <Icon name="star" className="size-5 shrink-0" />
            <div>
              <strong>Прогресс, который остаётся</strong>
              <p>Сохраняй настройки и двигайся по киношным званиям за общение.</p>
            </div>
          </li>
          <li>
            <Icon name="sparkles" className="size-5 shrink-0" />
            <div>
              <strong>Больше способов проявить себя</strong>
              <p>Оформи профиль, делись GIF и музыкой. С ростом звания публикуй статьи и фотографии.</p>
            </div>
          </li>
        </ul>
        <a id="landing-register" href="#landing-login" onClick={onRegister} className="landing-text-link mt-7">
          Зарегистрировать ник <Icon name="arrow-up-right" className="size-4" />
        </a>
      </div>
    </>
  )
}
