import { useState } from "react"
import { getSession } from "../features/accounts"
import { EntranceForm, readSession } from "../features/chat"
import { Icon } from "../shared/ui/Icon"
import { Hero } from "./landing/Hero"
import { Benefits } from "./landing/Benefits"
import { Directory } from "./landing/Directory"
import { Footer } from "./landing/Footer"
const getCsrf = async () => (await getSession()).csrf_token
export function LandingPage() {
  const [registering, setRegistering] = useState(false)
  const [entering, setEntering] = useState(false)
  const [canResume] = useState(() => readSession() !== null)
  const onRegister = () => {
    if (!entering) setRegistering(true)
  }
  const onLogin = () => {
    if (!entering) setRegistering(false)
  }
  return (
    <main>
      <div id="vertigo-landing" className="landing-page">
        <Hero />
        <div className="landing-container">
          <section id="landing-registration" className="landing-entrance" aria-labelledby="landing-registration-title">
            <Benefits onRegister={onRegister} />
            <div id="landing-login" className="landing-login-panel">
              <p className="landing-ticket-label">
                <span>Билет в хорошую компанию</span>
                <span aria-hidden="true">V / 01</span>
              </p>
              {canResume && (
                <a id="landing-resume-chat" href="/chat" className="landing-resume-link">
                  Вернуться в чат в этой вкладке <Icon name="arrow-right" className="size-4" />
                </a>
              )}
              <EntranceForm
                key={String(registering)}
                registering={registering}
                onRegister={onRegister}
                onLogin={onLogin}
                getCsrf={getCsrf}
                onPendingChange={setEntering}
              />
              <noscript>
                <p className="mt-4 text-sm">Для входа включи JavaScript в браузере.</p>
              </noscript>
            </div>
          </section>
          <Directory />
          <Footer onRegister={onRegister} onLogin={onLogin} />
        </div>
      </div>
    </main>
  )
}
