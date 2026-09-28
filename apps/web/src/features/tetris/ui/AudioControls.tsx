import type { useTetrisAudio } from "../model/useTetrisAudio"

export function AudioControls({ sound }: { sound: ReturnType<typeof useTetrisAudio> }) {
  const { music, setMusic, effects, setEffects, error, preview } = sound
  return (
    <div className="tetris-audio">
      <button id="tetris-audio-preview" type="button" onClick={preview}>
        Проверить звук
      </button>
      <label>
        Музыка{" "}
        <input
          id="tetris-music-volume"
          type="range"
          min="0"
          max="100"
          value={music}
          onChange={(e) => {
            setMusic(Number(e.target.value))
          }}
        />
      </label>
      <label>
        Звуки игры{" "}
        <input
          id="tetris-effects-volume"
          type="range"
          min="0"
          max="100"
          value={effects}
          onChange={(e) => {
            setEffects(Number(e.target.value))
          }}
        />
      </label>
      {error && <span role="alert">{error}</span>}
    </div>
  )
}
