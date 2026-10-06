import { useEffect, useRef, useState } from "react"
import { loadMaps, selectedPlace } from "../api/maps"
export function GuessMap({ apiKey, onPlace }: { apiKey: string; onPlace: (text: string) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const selected = useRef(onPlace)
  useEffect(() => {
    selected.current = onPlace
  }, [onPlace])
  const [message, setMessage] = useState("Нажмите на карту, чтобы выбрать страну или город")
  useEffect(() => {
    let active = true,
      version = 0
    let cleanup: (() => void) | undefined
    void loadMaps(apiKey)
      .then((maps) => {
        if (!active || !root.current) return
        const map = new maps.Map(root.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        })
        let marker: InstanceType<typeof maps.Marker> | undefined
        const listener = map.addListener("click", (event) => {
          if (!event.latLng) return
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() },
            request = ++version
          if (marker) marker.setPosition(point)
          else marker = new maps.Marker({ map, position: point })
          setMessage("Определяем место…")
          void new maps.Geocoder()
            .geocode({ location: point })
            .then(({ results }) => {
              if (!active || request !== version) return
              const text = selectedPlace(results)
              if (text) {
                selected.current(text)
                setMessage("Метка перенесена в поле ответа. Нажмите «Ответить».")
              } else setMessage("Не удалось определить место. Введите ответ словами.")
            })
            .catch(() => {
              if (active) setMessage("Не удалось определить место. Введите ответ словами.")
            })
        })
        cleanup = () => {
          listener.remove()
          marker?.setMap(null)
        }
      })
      .catch((reason: unknown) => {
        if (active) setMessage(reason instanceof Error ? reason.message : "Карта недоступна.")
      })
    return () => {
      active = false
      cleanup?.()
    }
  }, [apiKey])
  return (
    <>
      <div ref={root} className="geo-google-map" aria-label="Карта для выбора ответа" />
      <div className="geo-map-message" role="status">
        {message}
      </div>
    </>
  )
}
