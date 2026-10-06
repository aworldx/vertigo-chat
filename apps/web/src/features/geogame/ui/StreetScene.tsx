import { useEffect, useRef, useState } from "react"
import { loadMaps, type Panorama } from "../api/maps"
import type { GeoSnapshot } from "../api/game"

export function StreetScene({ game, onError }: { game: GeoSnapshot; onError: () => void }) {
  const element = useRef<HTMLDivElement>(null)
  const instance = useRef<Panorama | null>(null)
  const onFailure = useRef(onError)
  useEffect(() => {
    onFailure.current = onError
  }, [onError])
  const [ready, setReady] = useState(false)
  const pano = game.scene?.pano_id ?? ""
  const heading = game.scene?.heading ?? 0
  const pitch = game.scene?.pitch ?? 0
  const key = game.browser_key ?? ""
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    const timer = window.setTimeout(() => {
      if (!cancelled) onFailure.current()
    }, 20000)
    void loadMaps(key)
      .then((maps) => {
        if (cancelled || !element.current) return
        const view = new maps.StreetViewPanorama(element.current, {
          pano,
          pov: { heading, pitch },
          zoom: 1,
          disableDefaultUI: true,
          linksControl: true,
          clickToGo: true,
          zoomControl: true,
          panControl: true,
          addressControl: false,
          showRoadLabels: false,
          motionTracking: false,
          motionTrackingControl: false,
          fullscreenControl: false,
          enableCloseButton: false,
        })
        instance.current = view
        const status = view.addListener("status_changed", () => {
          if (cancelled) return
          clearTimeout(timer)
          if (view.getStatus() === "OK") setReady(true)
          else onFailure.current()
        })
        const resize = new ResizeObserver(() => {
          maps.event.trigger(view, "resize")
        })
        resize.observe(element.current)
        dispose = () => {
          status.remove()
          resize.disconnect()
          view.setVisible(false)
          instance.current = null
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timer)
          onFailure.current()
        }
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
      dispose()
    }
  }, [key, pano, heading, pitch])
  return (
    <>
      <div
        ref={element}
        className="geo-panorama"
        aria-label="Панорама места: можно осматриваться и перемещаться по стрелкам"
      />
      {!ready && (
        <div className="geo-panorama-status" role="status">
          Загружаем панораму…
        </div>
      )}
      <button
        type="button"
        className="geo-return"
        disabled={!ready}
        onClick={() => {
          instance.current?.setPano(pano)
          instance.current?.setPov({ heading, pitch })
          instance.current?.setZoom(1)
        }}
      >
        К началу
      </button>
    </>
  )
}
