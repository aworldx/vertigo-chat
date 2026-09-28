import type { Message } from "../../api/protocol"
import { safeMediaURL, type MediaItem } from "../../api/media"
import type { Track } from "./queue"
export function mediaTrack(item: MediaItem, author = ""): Track | null {
  if (item.kind === "gif" || !safeMediaURL(item.kind, item.url)) return null
  return {
    source: item.kind === "youtube" ? item.url : `/music-proxy?url=${encodeURIComponent(item.url)}`,
    title: [item.artist, item.title].filter(Boolean).join(" — "),
    author,
    kind: item.kind === "youtube" ? "video" : "music",
    prepare: item.kind === "youtube",
  }
}
export function messageTrack(message: Message): Track | null {
  if (message.kind !== "music" && message.kind !== "youtube") return null
  const track = mediaTrack(
    {
      kind: message.kind,
      url: message.media_url ?? "",
      title: message.body,
      artist: message.artist ?? "",
      duration: message.duration ?? "",
      preview: "",
      source: "",
    },
    message.author,
  )
  return track ? { ...track, messageID: message.id } : null
}
