// Quiet original synthesized soundtrack. No remote audio, tracking or autoplay.
export class TetrisAudio {
  private context: AudioContext | null = null
  private musicTimer: ReturnType<typeof setInterval> | undefined
  music = 0.18
  effects = 0.7
  private step = 0
  volumes(music: number, effects: number) {
    this.music = music
    this.effects = effects
  }
  async enable() {
    this.context ??= new AudioContext()
    await this.context.resume()
    if (!this.musicTimer) {
      this.playBar()
      this.musicTimer = setInterval(() => {
        this.playBar()
      }, 3200)
    }
  }
  private note(frequency: number, at: number, duration: number, volume: number, type: OscillatorType = "sine") {
    const ctx = this.context
    if (!ctx || ctx.state !== "running" || volume <= 0) return
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + duration + 0.02)
  }
  private playBar() {
    if (!this.context || document.hidden) return
    const chords = [
      [130.81, 164.81, 196],
      [110, 130.81, 164.81],
      [87.31, 110, 130.81],
      [98, 123.47, 146.83],
    ]
    const chord = chords[this.step++ % chords.length] ?? chords[0] ?? []
    const now = this.context.currentTime
    chord.forEach((f, i) => {
      this.note(f, now, 3.1, this.music * 0.05)
      this.note(f * 2, now + i * 0.8, 1.3, this.music * 0.09)
    })
  }
  effect(kind: "move" | "rotate" | "drop" | "lock" | "clear" | "attack") {
    const now = this.context?.currentTime ?? 0
    if (kind === "move") {
      this.note(600, now, 0.035, this.effects * 0.12, "triangle")
    } else if (kind === "rotate") {
      this.note(440, now, 0.06, this.effects * 0.16, "triangle")
      this.note(660, now + 0.025, 0.06, this.effects * 0.12, "triangle")
    } else if (kind === "drop") {
      this.note(300, now, 0.07, this.effects * 0.18, "triangle")
      this.note(150, now + 0.035, 0.1, this.effects * 0.2, "triangle")
    } else if (kind === "lock") {
      this.note(180, now, 0.09, this.effects * 0.28, "triangle")
      this.note(90, now, 0.12, this.effects * 0.22)
    } else if (kind === "clear") {
      this.note(110, now, 0.16, this.effects * 0.24, "triangle")
      ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        this.note(frequency, now + index * 0.045, 0.25, this.effects * 0.2, "triangle")
      })
    } else {
      this.note(220, now, 0.12, this.effects * 0.22, "triangle")
      this.note(261.63, now + 0.08, 0.12, this.effects * 0.22, "triangle")
    }
  }

  suspend() {
    void this.context?.suspend().catch(() => undefined)
  }
  dispose() {
    clearInterval(this.musicTimer)
    this.musicTimer = undefined
    void this.context?.close().catch(() => undefined)
    this.context = null
  }
}
