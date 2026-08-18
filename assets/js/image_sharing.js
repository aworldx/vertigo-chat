// Назначение файла: P2P-картинки с потоковым fallback без сохранения файлов на сервере.
const CHUNK_SIZE = 16 * 1024
const MAX_BUFFERED_AMOUNT = 256 * 1024
const FILE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 20 * 1000

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

const readImageType = async blob => {
  const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  return detectedImageType(signature)
}

const peerKey = (shareId, peerId) => `${shareId}:${peerId}`

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

const ImageSharing = {
  mounted() {
    this.form = this.el.closest("form")
    this.input = this.el.querySelector("#image-file-input")
    this.attachButton = this.el.querySelector("#attach-image")
    this.dropOverlay = this.el.querySelector("#image-drop-overlay")
    this.clientError = this.el.querySelector("#image-client-error")
    this.canShare = this.el.dataset.canShare === "true"
    this.peerId = this.el.dataset.peerId
    this.maxFileSize = Number(this.el.dataset.maxFileSize)
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
      const button = event.target.closest("[data-show-image]")
      const card = button?.closest("[data-image-placeholder]")
      if (card) this.showImage(card)
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

    this.handleEvent("image-signal", signal => this.handleSignal(signal))
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
      this.showClientError("Отправлять изображения могут только зарегистрированные чатлане.")
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

    const error = await this.validateFile(file)
    if (error) {
      this.showClientError(error)
      return
    }

    const shareId = crypto.randomUUID()
    const expiryTimer = setTimeout(() => this.files.delete(shareId), FILE_TTL_MS)
    this.files.set(shareId, {file, expiryTimer})

    this.pushEvent(
      "announce_image",
      {share_id: shareId, name: file.name, type: file.type, size: file.size},
      reply => {
        if (reply?.ok) return

        clearTimeout(expiryTimer)
        this.files.delete(shareId)
        this.showClientError(reply?.error || "Не удалось отправить изображение.")
      },
    )
  },

  async validateFile(file) {
    if (!this.canShare) return "Отправлять изображения могут только зарегистрированные чатлане."
    if (!this.acceptedTypes.has(file.type)) return "Можно выбрать JPG, PNG или WebP."
    if (file.size <= 0 || file.size > this.maxFileSize) return "Размер изображения не должен превышать 5 МБ."

    const actualType = await readImageType(file)
    if (actualType !== file.type) return "Содержимое файла не соответствует формату изображения."

    return null
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

  showImage(card) {
    const shareId = card.dataset.shareId

    if (card.dataset.owned === "true") {
      const entry = this.files.get(shareId)
      if (!entry) {
        setPlaceholderStatus(card, "Изображение больше недоступно.", true)
        return
      }

      revealImage(card, entry.file, card.dataset.fileName, this.objectUrls)
      return
    }

    setPlaceholderStatus(card, "Запрашиваем изображение у автора…")
    this.pushEvent("request_image", {share_id: shareId}, reply => {
      if (reply?.ok) {
        this.startReceiver(card)
      } else {
        setPlaceholderStatus(card, reply?.error || "Изображение недоступно.", true)
      }
    })
  },

  async startReceiver(card) {
    const shareId = card.dataset.shareId
    const senderPeer = card.dataset.senderPeer
    const peer = this.createPeer(shareId, senderPeer, card)
    const channel = peer.pc.createDataChannel("image", {ordered: true})
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
      const card = document.getElementById(`image-preview-${signal.share_id}`)
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

    channel.onopen = () => {
      if (peer.timeout) clearTimeout(peer.timeout)
      setPlaceholderStatus(peer.card, "Получаем изображение напрямую от автора…")
    }
    channel.onmessage = async event => {
      if (typeof event.data !== "string") {
        const chunk = new Uint8Array(event.data)
        chunks.push(chunk)
        receivedSize += chunk.byteLength

        if (receivedSize > Number(peer.card.dataset.fileSize)) {
          setPlaceholderStatus(peer.card, "Получен файл неверного размера.", true)
          this.closePeer(peer.shareId, peer.remotePeer)
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

      const blob = new Blob(chunks, {type: peer.card.dataset.contentType})
      const actualType = await readImageType(blob)
      if (actualType !== peer.card.dataset.contentType) {
        setPlaceholderStatus(peer.card, "Полученный файл не является допустимым изображением.", true)
        this.closePeer(peer.shareId, peer.remotePeer)
        return
      }

      revealImage(peer.card, blob, peer.card.dataset.fileName, this.objectUrls)
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
      const bytes = new Uint8Array(await file.arrayBuffer())

      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        await this.waitForBuffer(channel)
        channel.send(bytes.slice(offset, offset + CHUNK_SIZE))
      }

      await this.waitForBuffer(channel)
      channel.send(JSON.stringify({type: "complete", size: bytes.length}))
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

    const timeout = setTimeout(() => {
      this.relayTransfers.delete(shareId)
      setPlaceholderStatus(card, "Автор не ответил. Изображение недоступно.", true)
    }, REQUEST_TIMEOUT_MS)

    this.relayTransfers.set(shareId, {
      card,
      senderPeer,
      chunks: null,
      received: 0,
      timeout,
    })

    this.pushEvent("request_image_relay", {share_id: shareId}, reply => {
      if (reply?.ok) return

      clearTimeout(timeout)
      this.relayTransfers.delete(shareId)
      setPlaceholderStatus(card, reply?.error || "Изображение недоступно.", true)
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
      const imageChunk = btoa(String.fromCharCode(...chunk))

      await this.sendRelayChunk(signal.from, signal.share_id, index, total, imageChunk)
    }
  },

  sendRelayChunk(target, shareId, index, total, imageChunk) {
    return new Promise((resolve, reject) => {
      this.pushEvent(
        "image_relay_chunk",
        {target, share_id: shareId, index, total, image_chunk: imageChunk},
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
      const binary = atob(signal.image_chunk)
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
    const actualType = await readImageType(blob)
    if (actualType !== transfer.card.dataset.contentType) {
      setPlaceholderStatus(transfer.card, "Полученный файл не является изображением.", true)
      return
    }

    revealImage(transfer.card, blob, transfer.card.dataset.fileName, this.objectUrls)
  },

  async flushCandidates(peer) {
    for (const candidate of peer.pendingCandidates) await peer.pc.addIceCandidate(candidate)
    peer.pendingCandidates = []
  },

  sendSignal(target, shareId, kind, payload) {
    return new Promise((resolve, reject) => {
      this.pushEvent("image_signal", {target, share_id: shareId, kind, payload}, reply => {
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

export default ImageSharing
