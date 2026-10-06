import test from "node:test"
import assert from "node:assert/strict"
import { placeText, selectedPlace } from "../src/features/geogame/api/maps"
import { sceneURL, type GeoSnapshot } from "../src/features/geogame/api/game"
import { chatCommands } from "../src/shared/chatCommands"
import { chatHelp } from "../src/shared/chatHelp"

test("map selection produces the same explicit country/city answer as text entry", () => {
  assert.equal(
    placeText({
      address_components: [
        { long_name: "Италия", types: ["country"] },
        { long_name: "Манарола", types: ["locality"] },
      ],
    }),
    "Италия, Манарола",
  )
  assert.equal(placeText({ address_components: [{ long_name: "Unnamed", types: ["locality"] }] }), "")
  assert.equal(placeText({ address_components: [{ long_name: "Италия", types: ["country"] }] }), "Италия")
})
test("panorama request preserves pinned opaque ID and excludes target coordinates", () => {
  const game: GeoSnapshot = {
    id: "id",
    phase: "active",
    round: 1,
    total: 5,
    deadline: "",
    server_time: "",
    cooldown: "",
    configured: true,
    own_answer: "",
    answered: 0,
    leaders: [],
    browser_key: "browser-key",
    scene: { pano_id: "ID_a+/b", heading: 20, pitch: -3 },
  }
  const url = new URL(sceneURL(game))
  assert.equal(url.searchParams.get("pano"), "ID_a+/b")
  assert.equal(url.searchParams.get("pitch"), "-3")
  assert.equal(url.searchParams.has("location"), false)
  assert.equal(new URL(sceneURL(game, { width: 1280, height: 600 })).searchParams.get("size"), "640x300")
  assert.equal(new URL(sceneURL(game, { width: 350, height: 700 })).searchParams.get("size"), "320x640")
  assert.equal(chatCommands.find((command) => command.input === "/гео")?.topic, "geo")
  assert.match(chatHelp.geo.body, /без|Приглашения не нужны/u)
  assert.match(chatHelp.geo.body, /пока|Пока|Google/u)
})

test("map ignores technical plus-code results without a country", () => {
  assert.equal(
    selectedPlace([
      { address_components: [{ long_name: "code", types: ["plus_code"] }] },
      { address_components: [{ long_name: "Алжир", types: ["country"] }] },
    ]),
    "Алжир",
  )
})
