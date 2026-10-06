type Coordinate = { lat: number; lng: number }
type MapClick = { latLng?: { lat: () => number; lng: () => number } }
type GoogleMap = { addListener: (name: string, fn: (e: MapClick) => void) => { remove: () => void } }
type GeocodeResult = { address_components: { long_name: string; types: string[] }[] }
export type Panorama = {
  setPano: (id: string) => void
  setPov: (pov: { heading: number; pitch: number }) => void
  setZoom: (zoom: number) => void
  setVisible: (visible: boolean) => void
  getStatus: () => string
  getLinks: () => { pano?: string }[]
  addListener: (name: string, handler: () => void) => { remove: () => void }
}
export type Maps = {
  StreetViewPanorama: new (
    element: HTMLElement,
    options: {
      pano: string
      pov: { heading: number; pitch: number }
      zoom: number
      disableDefaultUI: boolean
      linksControl: boolean
      clickToGo: boolean
      zoomControl: boolean
      panControl: boolean
      addressControl: boolean
      showRoadLabels: boolean
      motionTracking: boolean
      motionTrackingControl: boolean
      fullscreenControl: boolean
      enableCloseButton: boolean
    },
  ) => Panorama
  event: { trigger: (instance: Panorama, name: string) => void }

  Map: new (
    element: HTMLElement,
    options: {
      center: Coordinate
      zoom: number
      disableDefaultUI: boolean
      zoomControl: boolean
      clickableIcons: boolean
      gestureHandling: string
    },
  ) => GoogleMap
  Marker: new (options: { map: GoogleMap; position: Coordinate }) => {
    setPosition: (point: Coordinate) => void
    setMap: (map: GoogleMap | null) => void
  }
  Geocoder: new () => { geocode: (options: { location: Coordinate }) => Promise<{ results: GeocodeResult[] }> }
}
let loading: Promise<Maps> | undefined
export function loadMaps(key: string): Promise<Maps> {
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    const timer = window.setTimeout(() => {
      script.remove()
      loading = undefined
      reject(new Error("Карта не загрузилась. Ответьте словами."))
    }, 15000)
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: "quarterly", language: "ru" })}`
    script.async = true
    script.onload = () => {
      clearTimeout(timer)
      const google = (window as unknown as { google?: { maps?: Maps } }).google
      if (google?.maps) resolve(google.maps)
      else {
        loading = undefined
        reject(new Error("Карта недоступна. Ответьте словами."))
      }
    }
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      loading = undefined
      reject(new Error("Карта недоступна. Ответьте словами."))
    }
    document.head.append(script)
  })
  return loading
}
export function placeText(result: GeocodeResult): string {
  let country = "",
    city = ""
  for (const component of result.address_components) {
    if (component.types.includes("country")) country = component.long_name
    if (component.types.includes("locality") || component.types.includes("postal_town")) city = component.long_name
  }
  return country ? [country, city].filter(Boolean).join(", ") : ""
}

export function selectedPlace(results: GeocodeResult[]): string {
  return results.map(placeText).find(Boolean) ?? ""
}
