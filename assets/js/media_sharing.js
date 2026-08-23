// Назначение файла: P2P-изображения и потоковая передача музыки без хранения на сервере.
const CHUNK_SIZE = 16 * 1024
const MAX_BUFFERED_AMOUNT = 256 * 1024
const FILE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 20 * 1000
const SIGNATURE_SCAN_SIZE = 64 * 1024

const bytesEqual = (bytes, expected, offset = 0) =>
  expected.every((value, index) => bytes[offset + index] === value)

const detectedImageType = bytes => {
  if (bytesEqual(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (bytesEqual(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"

  if (
    bytesEqual(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesEqual(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp"
  }

  return null
}

const detectedAudioType = bytes => {
  if (bytesEqual(bytes, [0x4f, 0x67, 0x67, 0x53])) return "audio/ogg"
  if (bytesEqual(bytes, [0x52, 0x49, 0x46, 0x46]) && bytesEqual(bytes, [0x57, 0x41, 0x56, 0x45], 8)) return "audio/wav"
  if (bytesEqual(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return "audio/mp4"
  if (bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)) return "audio/aac"

  for (let offset = 0; offset <= bytes.length - 3; offset += 1) {
    if (bytesEqual(bytes, [0x49, 0x44, 0x33], offset)) return "audio/mpeg"

    if (offset <= bytes.length - 4 && isMpegAudioFrame(bytes, offset)) {
      return "audio/mpeg"
    }
  }

  return null
}

const isMpegAudioFrame = (bytes, offset) => {
  const header1 = bytes[offset + 1]
  const header2 = bytes[offset + 2]
  const version = (header1 >> 3) & 0x03
  const layer = (header1 >> 1) & 0x03
  const bitrate = (header2 >> 4) & 0x0f
  const sampleRate = (header2 >> 2) & 0x03

  return (
    bytes[offset] === 0xff &&
    (header1 & 0xe0) === 0xe0 &&
    version !== 0x01 &&
    layer !== 0x00 &&
    bitrate !== 0x00 &&
    bitrate !== 0x0f &&
    sampleRate !== 0x03
  )
}

const normalizedMediaType = type => {
  if (type === "audio/x-wav") return "audio/wav"
  if (type === "audio/x-m4a") return "audio/mp4"
  if (type === "audio/mp3" || type === "audio/x-mp3") return "audio/mpeg"
  return type
}

const playbackMediaType = type => {
  const normalizedType = normalizedMediaType(type)
  return normalizedType === "audio/mp4" ? 'audio/mp4; codecs="mp4a.40.2"' : normalizedType
}

const canonicalAudioFileName = (name, contentType) => {
  if (contentType !== "audio/mp4") return name
  return name.replace(/\.[^.]*$/, "") + ".m4a"
}

const readMediaType = async blob => {
  const signature = new Uint8Array(await blob.slice(0, SIGNATURE_SCAN_SIZE).arrayBuffer())
  return detectedImageType(signature) || detectedAudioType(signature)
}

const peerKey = (shareId, peerId) => `${shareId}:${peerId}`

const generateUuid = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"))
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`
}

const parseJsonArray = (value, fallback) => {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (_error) {
    return fallback
  }
}

const setPlaceholderStatus = (card, text, error = false) => {
  if (!card) return

  const wrapper = document.createElement("div")
  wrapper.className = "flex min-h-28 items-center justify-center p-5 text-center"

  const status = document.createElement("p")
  status.className = error ? "text-sm text-red-300" : "text-sm text-zinc-400"
  status.textContent = text

  wrapper.append(status)
  card.replaceChildren(wrapper)
}

const revealImage = (card, blob, fileName, objectUrls) => {
  const objectUrl = URL.createObjectURL(blob)
  objectUrls.add(objectUrl)

  const figure = document.createElement("figure")
  figure.className = "bg-zinc-950 p-3"

  const image = document.createElement("img")
  image.src = objectUrl
  image.alt = fileName
  image.loading = "lazy"
  image.decoding = "async"
  image.className = "mx-auto max-h-[32rem] w-auto max-w-full rounded-lg object-contain"
  image.addEventListener("load", () => {
    URL.revokeObjectURL(objectUrl)
    objectUrls.delete(objectUrl)
  }, {once: true})

  const caption = document.createElement("figcaption")
  caption.className = "mt-2 break-all text-center text-xs text-zinc-500"
  caption.textContent = fileName

  figure.append(image, caption)
  card.replaceChildren(figure)
  card.classList.remove("border-dashed")
}

const revealAudio = (card, blob, fileName, objectUrls) => {
  const objectUrl = URL.createObjectURL(blob)
  objectUrls.add(objectUrl)

  const wrapper = document.createElement("div")
  wrapper.className = "p-4"

  const title = document.createElement("p")
  title.className = "mb-3 break-all text-sm font-medium text-zinc-200"
  title.textContent = fileName

  const audio = document.createElement("audio")
  audio.controls = true
  audio.preload = "metadata"
  audio.className = "w-full accent-amber-300"

  const source = document.createElement("source")
  source.src = objectUrl
  source.type = playbackMediaType(blob.type)
  audio.append(source)

  wrapper.append(title, audio)
  card.replaceChildren(wrapper)
  card.classList.remove("border-dashed")
  audio.load()
}

const createAudioStream = (card, contentType, fileName, objectUrls) => {
  const normalizedType = normalizedMediaType(contentType)
  if (normalizedType === "audio/mp4") return null
  if (!window.MediaSource || !MediaSource.isTypeSupported(normalizedType)) return null

  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  objectUrls.add(objectUrl)
  const queue = []
  let sourceBuffer = null
  let complete = false
  let failed = false

  const wrapper = document.createElement("div")
  wrapper.className = "p-4"

  const header = document.createElement("div")
  header.className = "mb-3 flex items-center justify-between gap-3"

  const title = document.createElement("p")
  title.className = "min-w-0 truncate text-sm font-medium text-zinc-200"
  title.textContent = fileName

  const progress = document.createElement("span")
  progress.className = "shrink-0 text-xs tabular-nums text-amber-200"
  progress.textContent = "0%"

  const audio = document.createElement("audio")
  audio.src = objectUrl
  audio.controls = true
  audio.preload = "auto"
  audio.className = "w-full accent-amber-300"

  const finishIfReady = () => {
    if (complete && sourceBuffer && !sourceBuffer.updating && queue.length === 0 && mediaSource.readyState === "open") {
      mediaSource.endOfStream()
    }
  }

  const pump = () => {
    if (failed || !sourceBuffer || sourceBuffer.updating) return
    const chunk = queue.shift()
    if (!chunk) {
      finishIfReady()
      return
    }

    try {
      sourceBuffer.appendBuffer(chunk)
    } catch (_error) {
      failed = true
      setPlaceholderStatus(card, "Браузер не смог воспроизвести этот аудиопоток.", true)
    }
  }

  mediaSource.addEventListener("sourceopen", () => {
    try {
      sourceBuffer = mediaSource.addSourceBuffer(normalizedType)
      sourceBuffer.mode = "sequence"
      sourceBuffer.addEventListener("updateend", pump)
      sourceBuffer.addEventListener("error", () => {
        failed = true
        setPlaceholderStatus(card, "Ошибка воспроизведения аудиопотока.", true)
      })
      pump()
    } catch (_error) {
      failed = true
      setPlaceholderStatus(card, "Этот аудиоформат нельзя воспроизвести потоком.", true)
    }
  }, {once: true})

  header.append(title, progress)
  wrapper.append(header, audio)
  card.replaceChildren(wrapper)
  card.classList.remove("border-dashed")

  return {
    append(chunk) {
      if (failed) return
      queue.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
      pump()
    },
    setProgress(value) {
      progress.textContent = `${value}%`
    },
    complete() {
      complete = true
      progress.textContent = "готово"
      finishIfReady()
    },
  }
}

const MediaSharing = {
  mounted() {
    this.form = this.el.closest("form")
    this.input = this.el.querySelector("#media-file-input")
    this.attachButton = this.el.querySelector("#attach-media")
    this.dropOverlay = this.el.querySelector("#media-drop-overlay")
    this.clientError = this.el.querySelector("#media-client-error")
    this.canShare = this.el.dataset.canShare === "true"
    this.peerId = this.el.dataset.peerId
    this.maxImageSize = Number(this.el.dataset.maxImageSize)
    this.maxAudioSize = Number(this.el.dataset.maxAudioSize)
    this.relayChunkSize = Number(this.el.dataset.relayChunkSize)
    this.acceptedTypes = new Set(parseJsonArray(this.el.dataset.acceptedTypes, []))
    this.iceServers = parseJsonArray(this.el.dataset.iceServers, [])
    this.files = new Map()
    this.peers = new Map()
    this.relayTransfers = new Map()
    this.objectUrls = new Set()
    this.dragDepth = 0

    this.onAttachClick = () => this.input?.click()
    this.onFileChange = event => {
      const [file] = event.target.files
      if (file) this.prepareFile(file)
      event.target.value = ""
    }
    this.onDocumentClick = event => {
      const button = event.target.closest("[data-open-media]")
      const card = button?.closest("[data-media-placeholder]")
      if (card) this.openMedia(card)
    }
    this.onDragEnter = event => this.handleDragEnter(event)
    this.onDragOver = event => this.handleDragOver(event)
    this.onDragLeave = event => this.handleDragLeave(event)
    this.onDrop = event => this.handleDrop(event)

    this.attachButton?.addEventListener("click", this.onAttachClick)
    this.input?.addEventListener("change", this.onFileChange)
    document.addEventListener("click", this.onDocumentClick)
    this.form?.addEventListener("dragenter", this.onDragEnter)
    this.form?.addEventListener("dragover", this.onDragOver)
    this.form?.addEventListener("dragleave", this.onDragLeave)
    this.form?.addEventListener("drop", this.onDrop)

    this.handleEvent("media-signal", signal => this.handleSignal(signal))
  },

  destroyed() {
    this.attachButton?.removeEventListener("click", this.onAttachClick)
    this.input?.removeEventListener("change", this.onFileChange)
    document.removeEventListener("click", this.onDocumentClick)
    this.form?.removeEventListener("dragenter", this.onDragEnter)
    this.form?.removeEventListener("dragover", this.onDragOver)
    this.form?.removeEventListener("dragleave", this.onDragLeave)
    this.form?.removeEventListener("drop", this.onDrop)

    for (const peer of this.peers.values()) peer.pc.close()
    for (const transfer of this.relayTransfers.values()) clearTimeout(transfer.timeout)
    for (const entry of this.files.values()) clearTimeout(entry.expiryTimer)
    for (const objectUrl of this.objectUrls) URL.revokeObjectURL(objectUrl)
  },

  handleDragEnter(event) {
    if (!event.dataTransfer?.types.includes("Files")) return
    event.preventDefault()
    this.dragDepth += 1
    if (this.canShare) this.dropOverlay?.classList.replace("hidden", "flex")
  },

  handleDragOver(event) {
    if (!event.dataTransfer?.types.includes("Files")) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = this.canShare ? "copy" : "none"
  },

  handleDragLeave(event) {
    if (!event.dataTransfer?.types.includes("Files")) return
    this.dragDepth = Math.max(0, this.dragDepth - 1)
    if (this.dragDepth === 0) this.hideDropOverlay()
  },

  handleDrop(event) {
    event.preventDefault()
    this.dragDepth = 0
    this.hideDropOverlay()

    if (!this.canShare) {
      this.showClientError("Отправлять файлы могут только зарегистрированные чатлане.")
      return
    }

    const [file] = event.dataTransfer?.files || []
    if (file) this.prepareFile(file)
  },

  hideDropOverlay() {
    this.dropOverlay?.classList.replace("flex", "hidden")
  },

  async prepareFile(file) {
    this.clearClientError()

    const validation = await this.validateFile(file)
    if (validation.error) {
      this.showClientError(validation.error)
      return
    }

    const mediaFile =
      file.type === validation.contentType
        ? file
        : new File([file], canonicalAudioFileName(file.name, validation.contentType), {
            type: validation.contentType,
            lastModified: file.lastModified,
          })

    const shareId = generateUuid()
    const expiryTimer = setTimeout(() => this.files.delete(shareId), FILE_TTL_MS)
    this.files.set(shareId, {file: mediaFile, expiryTimer})

    this.pushEvent(
      "announce_media",
      {
        share_id: shareId,
        name: file.name,
        type: validation.contentType,
        size: mediaFile.size,
      },
      reply => {
        if (reply?.ok) return

        clearTimeout(expiryTimer)
        this.files.delete(shareId)
        this.showClientError(reply?.error || "Не удалось отправить файл.")
      },
    )
  },

  async validateFile(file) {
    if (!this.canShare) {
      return {error: "Отправлять файлы могут только зарегистрированные чатлане."}
    }
    if (!this.acceptedTypes.has(file.type)) {
      return {error: "Можно выбрать JPG, PNG, WebP, MP3, OGG, WAV, M4A или AAC."}
    }

    const kind = file.type.startsWith("image/") ? "image" : "audio"
    const maxSize = kind === "image" ? this.maxImageSize : this.maxAudioSize
    const sizeLabel = kind === "image" ? "5 МБ" : "50 МБ"
    if (file.size <= 0 || file.size > maxSize) {
      return {error: `Размер файла не должен превышать ${sizeLabel}.`}
    }

    const actualType = await readMediaType(file)
    const declaredType = normalizedMediaType(file.type)
    const compatibleAudioContainer = kind === "audio" && actualType?.startsWith("audio/")

    if (actualType !== declaredType && !compatibleAudioContainer) {
      return {error: "Содержимое файла не соответствует заявленному формату."}
    }

    return {error: null, contentType: actualType}
  },

  showClientError(message) {
    if (!this.clientError) return
    this.clientError.textContent = message
    this.clientError.className = "absolute bottom-full right-0 z-40 mb-3 max-w-sm rounded-lg border border-red-400/40 bg-zinc-950 px-3 py-2 text-sm text-red-300 shadow-xl"
  },

  clearClientError() {
    if (!this.clientError) return
    this.clientError.textContent = ""
    this.clientError.className = "hidden"
  },

  revealMedia(card, blob) {
    if (card.dataset.mediaKind === "audio") {
      revealAudio(card, blob, card.dataset.fileName, this.objectUrls)
    } else {
      revealImage(card, blob, card.dataset.fileName, this.objectUrls)
    }
  },

  openMedia(card) {
    const shareId = card.dataset.shareId

    if (card.dataset.owned === "true") {
      const entry = this.files.get(shareId)
      if (!entry) {
        setPlaceholderStatus(card, "Файл больше недоступен.", true)
        return
      }

      this.revealMedia(card, entry.file)
      return
    }

    setPlaceholderStatus(card, "Соединяемся с устройством автора…")
    this.pushEvent("request_media", {share_id: shareId}, reply => {
      if (reply?.ok) {
        this.startReceiver(card)
      } else {
        setPlaceholderStatus(card, reply?.error || "Файл недоступен.", true)
      }
    })
  },

  async startReceiver(card) {
    const shareId = card.dataset.shareId
    const senderPeer = card.dataset.senderPeer
    const peer = this.createPeer(shareId, senderPeer, card)
    const channel = peer.pc.createDataChannel("media", {ordered: true})
    this.configureReceiverChannel(peer, channel)
    peer.timeout = setTimeout(() => {
      this.fallbackToRelay(card, shareId, senderPeer)
    }, REQUEST_TIMEOUT_MS)

    try {
      const offer = await peer.pc.createOffer()
      await peer.pc.setLocalDescription(offer)
      await this.sendSignal(senderPeer, shareId, "offer", peer.pc.localDescription.toJSON())
    } catch (_error) {
      this.fallbackToRelay(card, shareId, senderPeer)
    }
  },

  async handleSignal(signal) {
    try {
      switch (signal.kind) {
        case "request":
          return
        case "relay_request":
          await this.sendRelayFile(signal).catch(() => {})
          break
        case "relay_chunk":
          await this.acceptRelayChunk(signal)
          break
        case "offer":
          await this.acceptOffer(signal)
          break
        case "answer":
          await this.acceptAnswer(signal)
          break
        case "candidate":
          await this.acceptCandidate(signal)
          break
      }
    } catch (_error) {
      const card = document.getElementById(`media-preview-${signal.share_id}`)
      if (card) this.fallbackToRelay(card, signal.share_id, signal.from)
      this.closePeer(signal.share_id, signal.from)
    }
  },

  async acceptOffer(signal) {
    const entry = this.files.get(signal.share_id)
    if (!entry) return

    const peer = this.createPeer(signal.share_id, signal.from, null)
    peer.pc.ondatachannel = event => this.configureSenderChannel(peer, event.channel, entry.file)
    await peer.pc.setRemoteDescription(signal.payload)
    await this.flushCandidates(peer)

    const answer = await peer.pc.createAnswer()
    await peer.pc.setLocalDescription(answer)
    await this.sendSignal(signal.from, signal.share_id, "answer", peer.pc.localDescription.toJSON())
  },

  async acceptAnswer(signal) {
    const peer = this.peers.get(peerKey(signal.share_id, signal.from))
    if (!peer) return
    await peer.pc.setRemoteDescription(signal.payload)
    await this.flushCandidates(peer)
  },

  async acceptCandidate(signal) {
    const peer = this.peers.get(peerKey(signal.share_id, signal.from))
    if (!peer) return

    if (peer.pc.remoteDescription) {
      await peer.pc.addIceCandidate(signal.payload)
    } else {
      peer.pendingCandidates.push(signal.payload)
    }
  },

  createPeer(shareId, remotePeer, card) {
    this.closePeer(shareId, remotePeer)

    const pc = new RTCPeerConnection({iceServers: this.iceServers})
    const peer = {pc, shareId, remotePeer, card, pendingCandidates: [], timeout: null}
    this.peers.set(peerKey(shareId, remotePeer), peer)

    pc.onicecandidate = event => {
      if (event.candidate) {
        this.sendSignal(remotePeer, shareId, "candidate", event.candidate.toJSON())
      }
    }
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        if (card && pc.connectionState === "failed") {
          this.fallbackToRelay(card, shareId, remotePeer)
        }
        this.closePeer(shareId, remotePeer)
      }
    }

    return peer
  },

  configureReceiverChannel(peer, channel) {
    channel.binaryType = "arraybuffer"
    const chunks = []
    let receivedSize = 0
    let lastProgress = -1
    let audioStream = null
    let signatureChecked = false

    channel.onopen = () => {
      if (peer.timeout) clearTimeout(peer.timeout)
      if (peer.card.dataset.mediaKind === "audio") {
        audioStream = createAudioStream(
          peer.card,
          peer.card.dataset.contentType,
          peer.card.dataset.fileName,
          this.objectUrls,
        )
      }

      if (!audioStream) {
        const label = peer.card.dataset.mediaKind === "audio" ? "музыку" : "изображение"
        setPlaceholderStatus(peer.card, `Получаем ${label} напрямую от автора… 0%`)
      }
    }
    channel.onmessage = async event => {
      if (typeof event.data !== "string") {
        const chunk = new Uint8Array(event.data)

        if (!signatureChecked) {
          signatureChecked = true
          const actualType = detectedImageType(chunk) || detectedAudioType(chunk)
          if (actualType !== normalizedMediaType(peer.card.dataset.contentType)) {
            setPlaceholderStatus(peer.card, "Полученный файл имеет неверный формат.", true)
            this.closePeer(peer.shareId, peer.remotePeer)
            return
          }
        }

        if (audioStream) audioStream.append(chunk)
        else chunks.push(chunk)
        receivedSize += chunk.byteLength

        const expectedSize = Number(peer.card.dataset.fileSize)
        if (receivedSize > expectedSize) {
          setPlaceholderStatus(peer.card, "Получен файл неверного размера.", true)
          this.closePeer(peer.shareId, peer.remotePeer)
        } else {
          const progress = Math.min(100, Math.floor((receivedSize / expectedSize) * 100))
          if (progress !== lastProgress) {
            lastProgress = progress
            if (audioStream) {
              audioStream.setProgress(progress)
            } else {
              const label = peer.card.dataset.mediaKind === "audio" ? "музыку" : "изображение"
              setPlaceholderStatus(peer.card, `Получаем ${label} напрямую от автора… ${progress}%`)
            }
          }
        }
        return
      }

      let message
      try {
        message = JSON.parse(event.data)
      } catch (_error) {
        setPlaceholderStatus(peer.card, "Получены некорректные данные.", true)
        this.closePeer(peer.shareId, peer.remotePeer)
        return
      }
      if (message.type !== "complete") return

      const expectedSize = Number(peer.card.dataset.fileSize)
      if (receivedSize !== expectedSize || message.size !== expectedSize) {
        setPlaceholderStatus(peer.card, "Получен файл неверного размера.", true)
        this.closePeer(peer.shareId, peer.remotePeer)
        return
      }

      if (audioStream) {
        audioStream.complete()
      } else {
        const blob = new Blob(chunks, {type: peer.card.dataset.contentType})
        const actualType = await readMediaType(blob)
        if (actualType !== normalizedMediaType(peer.card.dataset.contentType)) {
          setPlaceholderStatus(peer.card, "Полученный файл имеет неверный формат.", true)
          this.closePeer(peer.shareId, peer.remotePeer)
          return
        }

        this.revealMedia(peer.card, blob)
      }

      this.closePeer(peer.shareId, peer.remotePeer)
    }
    channel.onerror = () => {
      this.fallbackToRelay(peer.card, peer.shareId, peer.remotePeer)
    }
  },

  configureSenderChannel(peer, channel, file) {
    channel.binaryType = "arraybuffer"
    channel.bufferedAmountLowThreshold = 64 * 1024
    channel.onopen = () => this.sendFile(peer, channel, file)
  },

  async sendFile(peer, channel, file) {
    try {
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        await this.waitForBuffer(channel)
        channel.send(await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer())
      }

      await this.waitForBuffer(channel)
      channel.send(JSON.stringify({type: "complete", size: file.size}))
    } catch (_error) {
      channel.close()
      this.closePeer(peer.shareId, peer.remotePeer)
    }
  },

  waitForBuffer(channel) {
    if (channel.bufferedAmount <= MAX_BUFFERED_AMOUNT) return Promise.resolve()

    return new Promise(resolve => {
      channel.addEventListener("bufferedamountlow", resolve, {once: true})
    })
  },

  fallbackToRelay(card, shareId, senderPeer) {
    if (!card || card.dataset.relayStarted === "true") return

    card.dataset.relayStarted = "true"
    this.closePeer(shareId, senderPeer)

    setPlaceholderStatus(card, "Прямое соединение недоступно. Передаём без сохранения на сервере…")

    const mediaSize = Number(card.dataset.fileSize) || 0
    const relayTimeoutMs = Math.max(REQUEST_TIMEOUT_MS, Math.ceil(mediaSize / 200_000) * 1000)
    const timeout = setTimeout(() => {
      this.relayTransfers.delete(shareId)
      setPlaceholderStatus(card, "Автор не ответил. Файл недоступен.", true)
    }, relayTimeoutMs)

    this.relayTransfers.set(shareId, {
      card,
      senderPeer,
      chunks: null,
      received: 0,
      timeout,
    })

    this.pushEvent("request_media_relay", {share_id: shareId}, reply => {
      if (reply?.ok) return

      clearTimeout(timeout)
      this.relayTransfers.delete(shareId)
      setPlaceholderStatus(card, reply?.error || "Файл недоступен.", true)
    })
  },

  async sendRelayFile(signal) {
    const entry = this.files.get(signal.share_id)
    if (!entry) return

    const bytes = new Uint8Array(await entry.file.arrayBuffer())
    const total = Math.ceil(bytes.length / this.relayChunkSize)

    for (let index = 0; index < total; index += 1) {
      const start = index * this.relayChunkSize
      const chunk = bytes.slice(start, start + this.relayChunkSize)
      const mediaChunk = btoa(String.fromCharCode(...chunk))

      await this.sendRelayChunk(signal.from, signal.share_id, index, total, mediaChunk)
    }
  },

  sendRelayChunk(target, shareId, index, total, mediaChunk) {
    return new Promise((resolve, reject) => {
      this.pushEvent(
        "media_relay_chunk",
        {target, share_id: shareId, index, total, media_chunk: mediaChunk},
        reply => {
          if (reply?.ok) resolve()
          else reject(new Error("relay chunk rejected"))
        },
      )
    })
  },

  async acceptRelayChunk(signal) {
    const transfer = this.relayTransfers.get(signal.share_id)
    if (!transfer || transfer.senderPeer !== signal.from) return

    if (!Number.isInteger(signal.index) || !Number.isInteger(signal.total)) return
    if (signal.index < 0 || signal.index >= signal.total) return

    if (!transfer.chunks) transfer.chunks = new Array(signal.total)
    if (transfer.chunks.length !== signal.total || transfer.chunks[signal.index]) return

    let bytes
    try {
      const binary = atob(signal.media_chunk)
      bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    } catch (_error) {
      return
    }

    transfer.chunks[signal.index] = bytes
    transfer.received += 1
    if (transfer.received !== signal.total) return

    clearTimeout(transfer.timeout)
    this.relayTransfers.delete(signal.share_id)

    const expectedSize = Number(transfer.card.dataset.fileSize)
    const receivedSize = transfer.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    if (receivedSize !== expectedSize) {
      setPlaceholderStatus(transfer.card, "Получен файл неверного размера.", true)
      return
    }

    const blob = new Blob(transfer.chunks, {type: transfer.card.dataset.contentType})
    const actualType = await readMediaType(blob)
    if (actualType !== normalizedMediaType(transfer.card.dataset.contentType)) {
      setPlaceholderStatus(transfer.card, "Полученный файл имеет неверный формат.", true)
      return
    }

    this.revealMedia(transfer.card, blob)
  },

  async flushCandidates(peer) {
    for (const candidate of peer.pendingCandidates) await peer.pc.addIceCandidate(candidate)
    peer.pendingCandidates = []
  },

  sendSignal(target, shareId, kind, payload) {
    return new Promise((resolve, reject) => {
      this.pushEvent("media_signal", {target, share_id: shareId, kind, payload}, reply => {
        if (reply?.ok) resolve()
        else reject(new Error("signal rejected"))
      })
    })
  },

  closePeer(shareId, remotePeer) {
    const key = peerKey(shareId, remotePeer)
    const peer = this.peers.get(key)
    if (!peer) return
    if (peer.timeout) clearTimeout(peer.timeout)
    this.peers.delete(key)
    if (peer.pc.connectionState !== "closed") peer.pc.close()
  },
}

export default MediaSharing
