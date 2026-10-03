import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { closePoll, createPoll, loadPollNotices, loadPolls, pollError, vote } from "../src/features/polls/api/polls"
import { AdminPolls, Polls } from "../src/features/polls/ui/Polls"

const poll = {
  id: 1,
  question: "Какой сценарий?",
  status: "open" as const,
  options: [
    { id: 2, body: "Создание", position: 1, votes: 0 },
    { id: 3, body: "Голосование", position: 2, votes: 0 },
  ],
  totalVotes: 0,
  selectedOptionID: 0,
  createdAt: "2026-10-02T12:00:00Z",
  closedAt: null,
}

test("poll API validates data and attaches chat session plus CSRF to mutations", async (t) => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = []
  t.mock.method(globalThis, "fetch", (url: string, init?: RequestInit) => {
    requests.push({ url, init })
    return Promise.resolve(new Response(JSON.stringify({ polls: [poll] }), { status: 200 }))
  })
  assert.deepEqual(await loadPolls("chat-token", false, new AbortController().signal), [poll])
  assert.deepEqual(await loadPollNotices("chat-token", new AbortController().signal), [poll])
  await vote(1, 2, "chat-token", "csrf-token")
  await createPoll("Вопрос", ["Да", "Нет"], "csrf-token")
  await closePoll(1, "csrf-token")
  assert.equal(requests[0]?.url, "/api/v1/polls")
  assert.equal(new Headers(requests[0].init?.headers).get("X-Chat-Session"), "chat-token")
  assert.equal(requests[1]?.url, "/api/v1/polls/notices")
  assert.equal(new Headers(requests[1].init?.headers).get("X-Chat-Session"), "chat-token")
  for (const request of requests.slice(2)) {
    assert.equal(new Headers(request.init?.headers).get("X-CSRF-Token"), "csrf-token")
  }
  const requestBody = (index: number) => {
    const body = requests[index]?.init?.body
    if (typeof body !== "string") throw new Error(`request ${String(index)} has no JSON body`)
    return body
  }
  const voteBody = requestBody(2),
    createBody = requestBody(3)
  assert.deepEqual(JSON.parse(voteBody), { option_id: 2 })
  assert.deepEqual(JSON.parse(createBody), { question: "Вопрос", options: ["Да", "Нет"] })
})

test("poll UI gives guests clear access guidance and admin form keeps usable fields", () => {
  const guest = renderToStaticMarkup(<Polls token="" csrf="" />)
  assert.match(guest, /Откройте эту страницу из активной вкладки чата/)
  assert.match(guest, /Мнение сообщества/)
  assert.match(guest, /Загружаем опросы/)
  const admin = renderToStaticMarkup(<AdminPolls csrf="csrf" />)
  assert.match(admin, /placeholder="Например, какую встречу провести следующей\?"/)
  assert.match(admin, /min-h-28/)
  assert.match(admin, /Добавить вариант/)
  assert.match(admin, /Создать опрос/)
})

test("poll errors preserve the post-vote and closed-poll feedback", () => {
  assert.equal(pollError(new Error("already_voted")), "Вы уже голосовали в этом опросе.")
  assert.equal(pollError(new Error("poll_closed")), "Этот опрос уже завершён.")
})
