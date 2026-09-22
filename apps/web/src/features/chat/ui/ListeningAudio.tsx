import { useContext, useEffect, useRef, type ComponentProps } from "react"
import { ListeningContext } from "../model/listeningContext"
export function ListeningAudio({ title, ...props }: ComponentProps<"audio"> & { title: string }) {
  const connection = useContext(ListeningContext)
  const playing = useRef(false)
  useEffect(
    () => () => {
      if (playing.current) connection?.listening(title, false)
    },
    [connection, title],
  )
  const stop = () => {
    if (playing.current) connection?.listening(title, false)
    playing.current = false
  }
  return (
    <audio
      {...props}
      data-track-title={title}
      onPlay={() => {
        playing.current = true
        connection?.listening(title, true)
      }}
      onPause={stop}
      onEnded={stop}
      onError={stop}
    >
      {props.children}
      <track kind="captions" label="Субтитры" />
    </audio>
  )
}
