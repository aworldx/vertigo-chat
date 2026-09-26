import type { components } from "../../../shared/generated/community"
import { record, requestJSON, jsonMutation } from "../../../shared/api/json"
export type BotStyle = components["schemas"]["BotStyle"]
export type BotLimits = components["schemas"]["BotLimits"]
export type AdminBot = components["schemas"]["AdminBot"]
export type AdminBots = components["schemas"]["AdminBots"]
export const botFonts = [
  { id: "theme", name: "Как в теме" },
  { id: "sans", name: "Без засечек" },
  { id: "display", name: "Выразительный" },
  { id: "serif", name: "С засечками" },
] as const
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v)
function colors(v: unknown): v is BotStyle["dark"] {
  return (
    record(v) &&
    typeof v.nickname_color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(v.nickname_color) &&
    typeof v.text_color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(v.text_color)
  )
}
export function validBotStyle(v: unknown): v is BotStyle {
  return (
    record(v) &&
    colors(v.dark) &&
    colors(v.light) &&
    botFonts.some((f) => f.id === v.font_id) &&
    (v.font_style === "normal" || v.font_style === "italic")
  )
}
function bot(v: unknown): v is AdminBot {
  return (
    record(v) && (v.id === "hitchcock" || v.id === "claire") && typeof v.name === "string" && validBotStyle(v.style)
  )
}
function limits(v: unknown): v is BotLimits {
  return (
    record(v) &&
    integer(v.daily_tokens) &&
    v.daily_tokens >= 0 &&
    v.daily_tokens <= 1000000000 &&
    integer(v.stop_percent) &&
    v.stop_percent >= 1 &&
    v.stop_percent <= 100
  )
}
export async function loadBots(signal: AbortSignal): Promise<AdminBots> {
  const v = await requestJSON("/api/v1/admin/bots", { signal })
  if (
    !record(v) ||
    !limits(v.limits) ||
    !integer(v.used_tokens) ||
    !integer(v.stop_threshold) ||
    !integer(v.utc_offset_minutes) ||
    !Array.isArray(v.bots) ||
    !v.bots.every(bot)
  )
    throw new Error("invalid_response")
  return {
    limits: v.limits,
    used_tokens: v.used_tokens,
    stop_threshold: v.stop_threshold,
    utc_offset_minutes: v.utc_offset_minutes,
    bots: v.bots,
  }
}
export async function saveBotLimits(value: BotLimits, csrf: string) {
  await requestJSON("/api/v1/admin/bots/budget", jsonMutation("PUT", csrf, value))
}
export async function saveBotStyle(id: AdminBot["id"], value: BotStyle, csrf: string) {
  await requestJSON(`/api/v1/admin/bots/${id}/style`, jsonMutation("PUT", csrf, value))
}
