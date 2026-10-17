import assert from "node:assert/strict"
import { test, beforeEach, afterEach } from "node:test"
import fs from "node:fs"
import { createRequire } from "node:module"

// Run from a staged-only tree with the caller's existing TypeScript; no network or installs.
const require = createRequire(import.meta.url)
const ts = require(process.env.QIVRO_TYPESCRIPT_MODULE || "typescript")
const originalLoader = require.extensions[".ts"]
require.extensions[".ts"] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(result.outputText, filename)
}
const clientPath = process.env.QIVRO_ADMIN_CLIENT_PATH || "../src/lib/api/client.ts"
const client = require(clientPath)
const auth = require(process.env.QIVRO_ADMIN_AUTH_PATH || "../src/lib/auth.ts")
// Staging need not copy or edit the existing transport to exercise it.
const trustFile = new URL("../src/lib/api/trust-evidence.ts", import.meta.url)
const output = ts.transpileModule(fs.readFileSync(trustFile, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const trustModule = { exports: {} }
new Function("require", "module", "exports", output)((name) => {
  assert.equal(name, "./client")
  return client
}, trustModule, trustModule.exports)
const trust = trustModule.exports
if (originalLoader) require.extensions[".ts"] = originalLoader
else delete require.extensions[".ts"]

const subject = "10000000-0000-4000-8000-000000000001"
const evidenceId = "20000000-0000-4000-8000-000000000001"
const actorId = "30000000-0000-4000-8000-000000000001"
const stamp = "2026-10-01T10:00:00.000Z"
const revokedStamp = "2026-10-02T10:00:00.000Z"
function evidence() {
  return { id: evidenceId, kind: "EMAIL", source: "QIVRO_EMAIL_CHALLENGE", status: "CONFIRMED", verifiedAt: stamp, expiresAt: null, revokedAt: null, version: 1, createdAt: stamp,
    audit: [{ action: "RECORDED", reasonCode: null, version: 1, createdAt: stamp, actorId: null }] }
}
function revoked() {
  const value = evidence()
  return { ...value, status: "REVOKED", version: 2, revokedAt: revokedStamp, audit: [...value.audit, { action: "REVOKED", reasonCode: "ADMIN_REVIEW", version: 2, createdAt: revokedStamp, actorId }] }
}
const originalFetch = global.fetch
const originalWindow = global.window
let calls, status, payload
beforeEach(() => {
  calls = []
  status = 200
  payload = { success: true, data: { data: [evidence()], nextCursor: null } }
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  global.window = { localStorage: storage, sessionStorage: storage, location: { href: "" } }
  global.fetch = async (url, options) => {
    calls.push({ url: new URL(url, "http://admin.fixture.invalid"), options })
    return new Response(JSON.stringify(payload), { status })
  }
})
afterEach(() => {
  global.fetch = originalFetch
  if (originalWindow === undefined) delete global.window
  else global.window = originalWindow
})

test("GET uses real nested metadata envelope, default limit, cookie auth and abort signal", async () => {
  const controller = new AbortController()
  const result = await trust.getTrustEvidence(subject, auth.getToken(), { signal: controller.signal })
  assert.deepEqual(result, { data: [evidence()], nextCursor: null })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.pathname, `/api/admin/trust/v1/users/${subject}/evidence`)
  assert.equal(calls[0].url.searchParams.get("limit"), "20")
  assert.equal(calls[0].options.method, "GET")
  assert.equal(calls[0].options.body, undefined)
  assert.equal(calls[0].options.credentials, "include")
  assert.equal(calls[0].options.headers.has("Authorization"), false)
  assert.equal(calls[0].options.signal, controller.signal)
})

test("cursor paging remains UUID-bounded with at most 50 records", async () => {
  payload.data.nextCursor = evidenceId
  await trust.getTrustEvidence(subject, "synthetic-token", { limit: 50 })
  assert.equal(calls[0].url.searchParams.get("limit"), "50")
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer synthetic-token")
  payload.data = { data: [], nextCursor: null }
  await trust.getTrustEvidence(subject, "synthetic-token", { limit: 1, cursor: evidenceId })
  assert.equal(calls[1].url.searchParams.get("cursor"), evidenceId)
  for (const options of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { cursor: "not-a-uuid" }]) {
    await assert.rejects(trust.getTrustEvidence(subject, "token", options))
  }
  for (const id of ["fixture@example.invalid", "contact", `${subject}/revoke`, "", "x".repeat(100)]) {
    await assert.rejects(trust.getTrustEvidence(id, "token"))
    assert.equal(trust.isTrustEvidenceUuid(id), false)
  }
  assert.equal(calls.length, 2)
})

test("unknown private fields are dropped at every metadata boundary", async () => {
  const value = revoked()
  Object.assign(value, { contactBinding: "PRIVATE_BINDING", challengeHash: "PRIVATE_CHALLENGE", email: "private@fixture.invalid", keyVersion: 1 })
  Object.assign(value.audit[1], { before: { secret: "PRIVATE_BEFORE" }, after: { secret: "PRIVATE_AFTER" }, note: "PRIVATE_NOTE" })
  payload.data = { data: [value], nextCursor: null, privateContact: "PRIVATE_CONTACT" }
  const result = await trust.getTrustEvidence(subject, "token")
  assert.deepEqual(result, { data: [revoked()], nextCursor: null })
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private@|contactBinding|challengeHash|before|after|keyVersion/)
})

for (const [name, mutate] of [
  ["unknown kind", (value) => { value.kind = "IDENTITY" }],
  ["unknown source", (value) => { value.source = "ADMIN_ASSERTION" }],
  ["unknown status", (value) => { value.status = "APPROVED" }],
  ["zero version", (value) => { value.version = 0 }],
  ["fractional version", (value) => { value.version = 1.1 }],
  ["overflow version", (value) => { value.version = 2147483648 }],
  ["private actor", (value) => { value.audit[0].actorId = "actor@fixture.invalid" }],
  ["invalid date", (value) => { value.verifiedAt = "not-a-date" }],
  ["invalid calendar date", (value) => { value.verifiedAt = "2026-02-31T10:00:00.000Z" }],
  ["missing audit", (value) => { delete value.audit }],
  ["empty audit", (value) => { value.audit = [] }],
  ["wrong audit version", (value) => { value.audit[0].version = 2 }],
  ["unknown reason", (value) => { value.audit[0].reasonCode = "PRIVATE_TEXT" }],
  ["revocation without date", (value) => { value.status = "REVOKED" }],
  ["confirmed with revocation date", (value) => { value.revokedAt = stamp }],
]) {
  test(`malformed schema rejects ${name} without retaining metadata`, async () => {
    const value = evidence()
    mutate(value)
    payload.data.data = [value]
    await assert.rejects(trust.getTrustEvidence(subject, "token"), trust.TrustEvidenceSchemaError)
    assert.equal(calls.length, 1)
  })
}

test("malformed envelope, duplicate records, excess page and invalid cursor fail closed", async () => {
  for (const page of [null, [], {}, { data: [], nextCursor: "private@fixture.invalid" }, { data: [evidence(), evidence()], nextCursor: null }, { data: Array.from({ length: 21 }, evidence), nextCursor: null }, { data: [evidence()], nextCursor: subject }]) {
    payload.data = page
    await assert.rejects(trust.getTrustEvidence(subject, "token"), trust.TrustEvidenceSchemaError)
  }
})

for (const reasonCode of trust.trustRevocationReasons) {
  test(`revocation sends only expected version and ${reasonCode}`, async () => {
    payload.data = { id: evidenceId, status: "REVOKED", version: 2, revokedAt: revokedStamp, contactBinding: "PRIVATE" }
    const result = await trust.revokeTrustEvidence(evidenceId, "token", { expectedVersion: 1, reasonCode, note: "must not be sent" })
    assert.deepEqual(result, { id: evidenceId, status: "REVOKED", version: 2, revokedAt: revokedStamp })
    assert.equal(calls[0].url.pathname, `/api/admin/trust/v1/evidence/${evidenceId}/revoke`)
    assert.equal(calls[0].options.method, "POST")
    assert.deepEqual(JSON.parse(calls[0].options.body), { expectedVersion: 1, reasonCode })
    assert.equal(calls.length, 1)
  })
}

test("invalid mutation inputs never write", async () => {
  for (const expectedVersion of [0, -1, 1.5, 2147483647, NaN, "1"]) {
    await assert.rejects(trust.revokeTrustEvidence(evidenceId, "token", { expectedVersion, reasonCode: "ADMIN_REVIEW" }))
  }
  await assert.rejects(trust.revokeTrustEvidence(evidenceId, "token", { expectedVersion: 1, reasonCode: "free-text" }))
  await assert.rejects(trust.revokeTrustEvidence("not-a-uuid", "token", { expectedVersion: 1, reasonCode: "ADMIN_REVIEW" }))
  assert.equal(calls.length, 0)
})

test("unvalidated mutation receipts never fabricate success", async () => {
  for (const value of [null, {}, { id: subject, status: "REVOKED", version: 2, revokedAt: stamp }, { id: evidenceId, status: "CONFIRMED", version: 2, revokedAt: stamp }, { id: evidenceId, status: "REVOKED", version: 1, revokedAt: stamp }, { id: evidenceId, status: "REVOKED", version: 2, revokedAt: null }]) {
    payload.data = value
    await assert.rejects(trust.revokeTrustEvidence(evidenceId, "token", { expectedVersion: 1, reasonCode: "ADMIN_REVIEW" }), trust.TrustEvidenceSchemaError)
  }
})

for (const code of [401, 403, 404, 409, 429, 503]) {
  test(`HTTP ${code} read and write errors propagate without retries or alternate actions`, async () => {
    status = code
    payload = { success: false, error: { message: "Synthetic failure" } }
    await assert.rejects(trust.getTrustEvidence(subject, auth.getToken()), (error) => error instanceof client.ApiRequestError && error.status === code)
    await assert.rejects(trust.revokeTrustEvidence(evidenceId, auth.getToken(), { expectedVersion: 1, reasonCode: "ADMIN_REVIEW" }), { status: code })
    assert.equal(calls.length, 2)
    if (code === 401) assert.equal(window.location.href, "/login?reason=session-expired")
    if (code === 403) assert.equal(window.location.href, "/forbidden")
  })
}

test("abort is propagated, including an already superseded read", async () => {
  const controller = new AbortController()
  controller.abort()
  global.fetch = async (_url, options) => {
    assert.equal(options.signal, controller.signal)
    options.signal.throwIfAborted()
  }
  await assert.rejects(trust.getTrustEvidence(subject, "token", { signal: controller.signal }), { name: "AbortError" })
})

test("staged route and review features transpile without syntax errors", () => {
  for (const name of ["app/trust/page.tsx", "features/trust/TrustEvidenceReview.tsx", "features/trust/TrustEvidenceTimeline.tsx"]) {
    const source = fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8")
    const result = ts.transpileModule(source, {
      fileName: name, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    })
    assert.deepEqual((result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error), [], name)
  }
})
