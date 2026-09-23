export const deliveryStates = ["sending", "retrying", "confirmed", "blocked", "failed", "published"] as const

export type DeliveryState = (typeof deliveryStates)[number]
export type PendingDeliveryState = Exclude<DeliveryState, "published">
export type DeliveryEvent = "retry" | "acknowledge" | "publish" | "block" | "fail"

const transitions: Record<DeliveryState, Partial<Record<DeliveryEvent, DeliveryState>>> = {
  sending: { acknowledge: "confirmed", block: "blocked", fail: "failed" },
  retrying: { retry: "sending", acknowledge: "confirmed", block: "blocked", fail: "failed" },
  confirmed: { publish: "published", block: "blocked", fail: "failed" },
  blocked: { retry: "sending" },
  failed: { retry: "sending" },
  published: {},
}

export function transitionDelivery(state: DeliveryState, event: DeliveryEvent): DeliveryState {
  return transitions[state][event] ?? state
}

export function isPendingDeliveryState(value: unknown): value is PendingDeliveryState {
  return typeof value === "string" && value !== "published" && deliveryStates.includes(value as DeliveryState)
}

export function transitionPendingDelivery(state: PendingDeliveryState, event: DeliveryEvent): PendingDeliveryState {
  const next = transitionDelivery(state, event)
  return next === "published" ? state : next
}
