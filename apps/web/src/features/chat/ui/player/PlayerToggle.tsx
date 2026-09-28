import { Button } from "../../../../shared/ui/Button"
import { usePlayer } from "../../model/player/context"
export function PlayerToggle({ className = "" }: { className?: string }) {
  const player = usePlayer()
  if (!player) return null
  return (
    <Button
      id="chat-tv-toggle"
      type="button"
      className={`ui-icon-button ${className}`}
      aria-label="Открыть телевизор"
      aria-expanded={player.state.mode === "expanded"}
      aria-controls="chat-tv-panel"
      onClick={() => {
        player.dispatch({ type: "mode", mode: player.state.mode === "expanded" ? "compact" : "expanded" })
      }}
    >
      <span aria-hidden="true">📺</span>
    </Button>
  )
}
