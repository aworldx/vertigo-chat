export function broadcastListening(nickname: string, track: string, active: boolean) {
  const channel = new BroadcastChannel("vertigo-listening")
  channel.postMessage({ nickname, track, active })
  channel.close()
}
