import { useScenePetTarget } from "../model/useScenePetTarget"
import { useKarmikPet } from "../model/useKarmikPet"

export function Karmik({
  mood = "resting",
  inScene = false,
  onPet = () => {},
}: {
  inScene?: boolean
  mood?: "resting" | "happy" | "angry"
  onPet?: () => void
}) {
  const pet = useKarmikPet(onPet)
  const { ref: targetRef, clip } = useScenePetTarget(inScene)
  return (
    <section
      id="karmik"
      data-mood={mood}
      className="karmik mt-auto hidden lg:flex"
      aria-label="Кармик, хранитель кармы чатлан"
    >
      <div
        id="karmik-sprite"
        ref={targetRef}
        style={
          inScene
            ? {
                clipPath: `inset(${String(clip.top)}px 0 0 0)`,
                visibility: clip.hidden ? "hidden" : undefined,
              }
            : undefined
        }
        className="karmik-sprite"
        role="button"
        tabIndex={0}
        aria-label="Погладить Кармика курсором"
        aria-describedby="karmik-name"
        onPointerMove={() => {
          pet()
        }}
        onPointerDown={() => {
          pet(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            pet(true)
          }
        }}
      />
      {mood === "happy" && (
        <span id="karmik-purr" className="karmik-purr" aria-live="polite">
          Мур-р-р!
        </span>
      )}
      <span id="karmik-name" className="karmik-tooltip" role="tooltip">
        Котик Кармик
      </span>
    </section>
  )
}
