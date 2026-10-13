const preparationLimitMs = 3 * 60_000
const pollIntervalMs = 2_000
const requestLimitMs = 10_000

const isAborted = (signal: AbortSignal) => signal.aborted

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", done)
      resolve()
    }
    const timer = setTimeout(done, pollIntervalMs)
    signal.addEventListener("abort", done, { once: true })
  })
}

// A video tag treats the worker's 202 response as a broken media source.
// Wait on HEAD instead, then attach the source only after ServeContent is ready.
export async function waitForVideoReady(source: string, signal: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + preparationLimitMs
  while (!isAborted(signal) && Date.now() < deadline) {
    const controller = new AbortController()
    const abort = () => {
      controller.abort()
    }
    signal.addEventListener("abort", abort, { once: true })
    const timeout = setTimeout(abort, requestLimitMs)
    try {
      const response = await fetch(source, { method: "HEAD", cache: "no-store", signal: controller.signal })
      if (isAborted(signal)) return false
      if (response.status === 200 || response.status === 206) return true
      if (response.status !== 202 && response.status < 500) return false
    } catch {
      if (isAborted(signal)) return false
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener("abort", abort)
    }
    await pause(signal)
  }
  return false
}
