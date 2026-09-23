import { Icon } from "../../../shared/ui/Icon"
import { useEffect } from "react"
import { Modal } from "../../../shared/ui/Modal"
import type { Photo } from "../api/gallery"
export function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  useEffect(() => {
    const value = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = value
    }
  }, [])
  return (
    <Modal
      id="gallery-lightbox"
      labelId="gallery-lightbox-title"
      onClose={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 opacity-100 transition duration-200 sm:p-8"
    >
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-label="Закрыть увеличенную фотографию"
        className="absolute inset-0 cursor-zoom-out bg-zinc-950/90 backdrop-blur-md"
      />
      <figure className="relative z-10 flex max-h-full max-w-full flex-col items-center gap-4">
        <img
          id="gallery-lightbox-image"
          src={photo.image}
          alt={`Фотография от ${photo.author}`}
          className="max-h-[calc(100vh-8rem)] max-w-[min(92vw,90rem)] scale-100 rounded-xl object-contain shadow-2xl ring-1 ring-white/10 transition duration-200"
        />
        <figcaption id="gallery-lightbox-title" className="max-w-3xl text-center text-sm text-zinc-300">
          {photo.caption || `Фотография от ${photo.author}`}
        </figcaption>
      </figure>
      <button
        id="close-gallery-lightbox"
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-zinc-100 shadow-xl backdrop-blur-sm transition hover:scale-105 hover:border-amber-300 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-7 sm:top-7"
      >
        <Icon name="x-mark" className="size-6" />
      </button>
    </Modal>
  )
}
