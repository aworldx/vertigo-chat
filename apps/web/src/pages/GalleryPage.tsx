import { Gallery } from "../features/gallery"
import { AccountBar, InlineLogin, useAccountSession } from "../features/accounts"
export function GalleryPage() {
  const { session, pending, signOut, refresh } = useAccountSession()
  return (
    <>
      {session?.principal && (
        <AccountBar
          principal={session.principal}
          pending={pending}
          onLogout={() => {
            void signOut()
          }}
        />
      )}
      <Gallery
        key={session?.principal?.user_id ?? 0}
        nickname={session?.principal?.nickname ?? ""}
        csrf={session?.csrf_token ?? ""}
        login={
          <InlineLogin
            id="gallery"
            onAuthenticated={() => {
              void refresh()
            }}
          />
        }
      />
    </>
  )
}
