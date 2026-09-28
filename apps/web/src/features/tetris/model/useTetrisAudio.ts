import { useCallback, useEffect, useRef, useState } from "react"
import type { Action, Game, Player } from "../api/protocol"
import { TetrisAudio } from "./audio"
import { boardSounds } from "./soundEvents"

export function useTetrisAudio(game: Game | null) {
  const [audio] = useState(() => new TetrisAudio())
  const [enabled, setEnabled] = useState(false)
  const [music, setMusic] = useState(18)
  const [effects, setEffects] = useState(70)
  const [error, setError] = useState("")
  const previous = useRef<Player | undefined>(undefined)
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        audio.suspend()
        setEnabled(false)
      }
    }
    document.addEventListener("visibilitychange", hide)
    return () => {
      audio.dispose()
      document.removeEventListener("visibilitychange", hide)
    }
  }, [audio])
  useEffect(() => {
    audio.volumes(music / 100, effects / 100)
  }, [audio, music, effects])
  useEffect(() => {
    const self = game?.players.find((p) => p.id === game.self)
    if (self && previous.current && enabled) {
      boardSounds(previous.current, self).forEach((sound) => {
        audio.effect(sound)
      })
    }
    previous.current = self
  }, [audio, enabled, game])
  const preview = useCallback(() => {
    void audio
      .enable()
      .then(() => {
        setEnabled(true)
        setError("")
        audio.effect("clear")
      })
      .catch(() => {
        setError("Браузер не разрешил включить звук.")
      })
  }, [audio])
  const toggle = () => {
    if (enabled) {
      audio.suspend()
      setEnabled(false)
    } else preview()
  }
  const input = useCallback(
    (action: Action) => {
      if (!enabled) return
      if (action === "left" || action === "right" || action === "down") audio.effect("move")
      else if (action === "rotate" || action === "counterrotate" || action === "hold") audio.effect("rotate")
      else if (action === "drop") audio.effect("drop")
    },
    [audio, enabled],
  )
  return { enabled, toggle, preview, input, music, setMusic, effects, setEffects, error }
}
