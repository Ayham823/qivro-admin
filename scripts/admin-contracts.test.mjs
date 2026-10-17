import assert from "node:assert/strict"
import { test, beforeEach, afterEach } from "node:test"
import fs from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"
const loadModule = createRequire(import.meta.url)

// Compile existing TS clients in-memory; all fetch calls are intercepted.
const previousLoader = loadModule.extensions[".ts"]
loadModule.extensions[".ts"] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(result.outputText, filename)
}
const auth = loadModule("../src/lib/auth.ts")
const client = loadModule("../src/lib/api/client.ts")
const operations = loadModule("../src/lib/api/operations.ts")
const media = loadModule("../src/lib/api/media-review.ts")
if (previousLoader) loadModule.extensions[".ts"] = previousLoader
else delete loadModule.extensions[".ts"]

const originalFetch = global.fetch
let calls, storage, response
beforeEach(() => {
  calls = []
  storage = new Map([["aqx_ops_token", "old-token"]])
  const storageApi = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  global.window = { localStorage: storageApi, sessionStorage: storageApi, location: { href: "" } }
  response = { status: 200, payload: { success: true, data: { id: "fixture" } } }
  global.fetch = async (url, options) => {
    calls.push({ path: new URL(url).pathname, options })
    return new Response(JSON.stringify(response.payload), { status: response.status })
  }
})
afterEach(() => {
  global.fetch = originalFetch
  delete global.window
})

test("cookie session removes legacy tokens and never persists login credentials", async () => {
  const token = auth.getToken()
  auth.saveToken("must-not-be-saved")
  await operations.getMe(token)
  assert.equal(storage.has("aqx_ops_token"), false)
  assert.equal([...storage.values()].includes("must-not-be-saved"), false)
  assert.equal(calls[0].options.credentials, "include")
  assert.equal(calls[0].options.headers.has("Authorization"), false)
})

test("login uses the existing auth contract", async () => {
  await operations.login("fixture@example.invalid", "test-only")
  assert.equal(calls[0].path, "/api/auth/login")
  assert.equal(calls[0].options.method, "POST")
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: "fixture@example.invalid", password: "test-only" })
})

for (const [status, target] of [[401, "/login?reason=session-expired"], [403, "/forbidden"]]) {
  test("HTTP " + status + " rejects protected requests and redirects", async () => {
    response = { status, payload: { success: false, error: { message: "Denied" } } }
    await assert.rejects(operations.getMe(auth.getToken()), (error) => error instanceof client.ApiRequestError && error.status === status)
    assert.equal(window.location.href, target)
  })
}

test("translation edits remain drafts; approve/publish require separate API calls", async () => {
  const body = { title: "Reviewed title", description: "Owner facts retained" }
  await operations.updateTranslation(auth.getToken(), "translation-1", body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, "/api/admin/translations/translation-1")
  assert.equal(calls[0].options.method, "PATCH")
  assert.deepEqual(JSON.parse(calls[0].options.body), body)
  for (const action of ["approve", "mark-reviewed", "reject", "publish", "regenerate"]) {
    await operations.runTranslationAction(auth.getToken(), "translation-1", action, { reason: "Fixture review" })
    assert.equal(calls.at(-1).path, "/api/admin/translations/translation-1/" + action)
    assert.equal(calls.at(-1).options.method, "POST")
  }
})

test("media review preserves decision and idempotency instead of publishing implicitly", async () => {
  const body = { decision: "APPROVE", idempotencyKey: "p0-review", note: "Reviewed" }
  await media.reviewAiMediaJob(auth.getToken(), "job-1", body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, "/api/admin/ai/media/reviews/job-1/decisions")
  assert.equal(calls[0].options.method, "POST")
  assert.deepEqual(JSON.parse(calls[0].options.body), body)
})

test("review queues preserve pagination metadata", async () => {
  response.payload = { success: true, data: [{ id: "job-1" }], meta: { total: 1, page: 1 }, counts: { pending: 1 } }
  const result = await media.getAiMediaReviewQueue(auth.getToken())
  assert.deepEqual(result, { data: [{ id: "job-1" }], meta: { total: 1, page: 1 }, counts: { pending: 1 } })
})

test("failed review is surfaced and never retried as another action", async () => {
  response = { status: 409, payload: { success: false, error: { message: "Stale review" } } }
  await assert.rejects(media.reviewAiMediaJob(auth.getToken(), "job-1", { decision: "PUBLISH", idempotencyKey: "p0-publish" }), { status: 409 })
  assert.equal(calls.length, 1)
})
