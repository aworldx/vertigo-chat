import { readSession } from "./storage"

// A named window keeps its own sessionStorage when reused. Refresh its chat
// identity before loading polls; never place a resume token in a URL or shared storage.
export function openPolls() {
  const session = readSession()
  const popup = window.open("", "vertigo-polls")
  if (!popup) {
    window.location.assign("/polls")
    return
  }
  try {
    if (session) popup.sessionStorage.setItem("vertigo.go-chat", JSON.stringify(session))
    else popup.sessionStorage.removeItem("vertigo.go-chat")
    popup.location.replace("/polls")
    popup.focus()
  } catch {
    // The named window may have navigated away from this origin.
    window.location.assign("/polls")
  }
}
