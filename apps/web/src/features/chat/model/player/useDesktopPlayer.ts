import { useSyncExternalStore } from "react"
const query = "(min-width: 768px) and (min-height: 481px)"
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}
function desktop() {
  return window.matchMedia(query).matches
}
export function useDesktopPlayer(enabled: boolean) {
  const wide = useSyncExternalStore(subscribe, desktop, () => false)
  return enabled && wide
}
