import { LoginForm } from "../features/accounts"

export function LoginPage({ registering }: { registering: boolean }) {
  return (
    <LoginForm
      registering={registering}
      onAuthenticated={() => {
        window.location.assign("/profiles")
      }}
    />
  )
}
