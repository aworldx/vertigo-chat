import { useEffect } from "react"
import { useRemote } from "../../../shared/model/useRemote"
import { loadGallery, galleryError } from "../api/gallery"
export function useGallery() {
  const resource = useRemote("gallery", loadGallery, galleryError)
  const { refresh } = resource
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, 5000)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])
  return { ...resource, loading: !resource.data && !resource.error }
}
