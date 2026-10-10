import { Icon } from "../../shared/ui/Icon"
import { landingContent } from "./content"

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
        <p className="landing-section-description">{landingContent.benefitsDescription}</p>
        <ul className="landing-benefit-list">
          <li>
            <Icon name="finger-print" className="size-5 shrink-0" />
            <div>
              <strong>Ник, который принадлежит тебе</strong>
              <p>{landingContent.benefits[0]}</p>
            </div>
          </li>
          <li>
            <Icon name="star" className="size-5 shrink-0" />
            <div>
              <strong>Прогресс, который остаётся</strong>
              <p>{landingContent.benefits[1]}</p>
            </div>
          </li>
          <li>
            <Icon name="sparkles" className="size-5 shrink-0" />
            <div>
              <strong>Больше способов проявить себя</strong>
              <p>{landingContent.benefits[2]}</p>
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
