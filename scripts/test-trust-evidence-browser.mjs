import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// The parent supplies an isolated Admin preview. This script never builds or starts services.
if (!process.env.QIVRO_ADMIN_TEST_URL || !process.env.QIVRO_PLAYWRIGHT_MODULE) {
  throw new Error("Set QIVRO_ADMIN_TEST_URL to an isolated loopback Admin preview and QIVRO_PLAYWRIGHT_MODULE to installed @playwright/test")
}
const base = new URL(process.env.QIVRO_ADMIN_TEST_URL)
if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Only an isolated HTTP loopback preview is allowed")
const require = createRequire(import.meta.url)
const { chromium, expect: baseExpect } = require(process.env.QIVRO_PLAYWRIGHT_MODULE)
const expect = baseExpect.configure({ timeout: 15000 })
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const artifacts = path.join(root, "test-results/trust-evidence")
mkdirSync(artifacts, { recursive: true })
const subject = "10000000-0000-4000-8000-000000000001"
const otherSubject = "10000000-0000-4000-8000-000000000002"
const evidenceId = "20000000-0000-4000-8000-000000000001"
const olderId = "20000000-0000-4000-8000-000000000002"
const actorId = "30000000-0000-4000-8000-000000000001"
const stamp = "2026-10-01T10:00:00.000Z"
const revokedStamp = "2026-10-02T10:00:00.000Z"
const fixture = (id = evidenceId) => ({ id, kind: "EMAIL", source: "QIVRO_EMAIL_CHALLENGE", status: "CONFIRMED", verifiedAt: stamp, expiresAt: null, revokedAt: null, version: 1, createdAt: stamp,
  audit: [{ action: "RECORDED", reasonCode: null, version: 1, createdAt: stamp, actorId: null }], contactBinding: "PRIVATE_BINDING", challengeHash: "PRIVATE_CHALLENGE", email: "PRIVATE_CONTACT" })
let checks = 0
const pass = (name) => { checks++; console.log(`[trust-browser] PASS ${name}`) }
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const writes = [], reads = [], errors = [], unexpected = []
    let authReads = 0, blockedScripts = 0
    page.on("console", (message) => {
      if (message.type() === "error" && /Content.Security.Policy|script.*(?:blocked|violates)/i.test(message.text())) blockedScripts++
    })
    page.on("pageerror", (error) => errors.push(error.message))
    let acceptDialog = true, dialogCount = 0
    page.on("dialog", async (dialog) => { dialogCount++; await (acceptDialog ? dialog.accept() : dialog.dismiss()) })
    let record = fixture(), readStatus = 200, writeStatus = 200, malformed = false
    let empty = false, role = "ADMIN", authStatus = 200, delayRead = false
    let delayedStarted, releaseDelayed, delayedFinished
    let delayedGate = Promise.resolve()
    let delayedDone = Promise.resolve()
    await context.route("**/*", async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const corsHeaders = { "access-control-allow-origin": base.origin, "access-control-allow-credentials": "true", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type, Authorization" }
      const respond = (data, status = 200) => route.fulfill({ status, headers: corsHeaders, json: { success: status === 200, data, error: status === 200 ? undefined : { message: "PRIVATE_ERROR_MUST_NOT_RENDER" } } })
      if (url.pathname.startsWith("/api/")) {
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders })
        if (url.pathname === "/api/auth/me") { authReads++; return respond({ id: actorId, email: "admin@fixture.invalid", role }, authStatus) }
        const lookup = url.pathname.match(/^\/api\/admin\/trust\/v1\/users\/([0-9a-f-]+)\/evidence$/i)
        if (lookup && request.method() === "GET") {
          reads.push({ id: lookup[1], cursor: url.searchParams.get("cursor") })
          assert.equal(url.searchParams.get("limit"), "20")
          assert.equal(request.postData(), null)
          const snapshot = structuredClone(record)
          if (delayRead) {
            delayRead = false
            delayedStarted()
            await delayedGate
            // The browser may cancel an aborted request before the fixture is released.
            try { return await respond({ data: [snapshot], nextCursor: null }) } catch { return } finally { delayedFinished() }
          }
          if (lookup[1] === otherSubject || empty) return respond({ data: [], nextCursor: null })
          if (readStatus !== 200) return respond(null, readStatus)
          if (malformed) return respond({ data: [{ ...record, source: "UNSUPPORTED_SOURCE" }], nextCursor: null })
          if (url.searchParams.get("cursor")) {
            assert.equal(url.searchParams.get("cursor"), evidenceId)
            return respond({ data: [fixture(olderId)], nextCursor: null })
          }
          return respond({ data: [record], nextCursor: evidenceId })
        }
        if (url.pathname === `/api/admin/trust/v1/evidence/${evidenceId}/revoke` && request.method() === "POST") {
          const body = request.postDataJSON()
          writes.push(body)
          assert.deepEqual(Object.keys(body).sort(), ["expectedVersion", "reasonCode"])
          if (writeStatus !== 200) return respond(null, writeStatus)
          assert.equal(body.expectedVersion, record.version)
          assert.ok(["COMPROMISED_CONTACT", "SUBJECT_REQUEST", "INVALID_EVIDENCE", "ADMIN_REVIEW"].includes(body.reasonCode))
          record = { ...record, status: "REVOKED", version: record.version + 1, revokedAt: revokedStamp,
            audit: [...record.audit, { action: "REVOKED", reasonCode: body.reasonCode, version: record.version + 1, createdAt: revokedStamp, actorId, before: "PRIVATE_BEFORE", after: "PRIVATE_AFTER" }] }
          return respond({ id: evidenceId, status: record.status, version: record.version, revokedAt: revokedStamp })
        }
        unexpected.push(`${request.method()} ${url.pathname}`)
        return respond(null, 501)
      }
      if (url.origin !== base.origin) return route.abort()
      return route.continue()
    })

    const input = page.getByLabel("User UUID", { exact: true })
    const load = page.getByRole("button", { name: "Load evidence", exact: true })
    const reload = page.getByRole("button", { name: "Reload latest evidence", exact: true })
    const timeline = page.getByRole("region", { name: "Evidence metadata", exact: true })
    const choose = async () => {
      await timeline.getByRole("button", { name: "Revoke evidence", exact: true }).click()
      await page.getByLabel("Revocation reason", { exact: true }).selectOption("ADMIN_REVIEW")
      await page.getByLabel("I confirm revocation of this evidence with the selected reason.", { exact: true }).check()
    }

    const initialResponse = await page.goto(`${base.origin}/trust?userId=${subject}`)
    assert.equal(Boolean(initialResponse?.headers()["content-security-policy"]?.includes("'nonce-")), true, "Keep nonce CSP enabled")
    try {
      await expect(page.getByRole("heading", { name: "Trust Evidence", exact: true })).toBeVisible()
    } catch (error) {
      console.error(JSON.stringify({ startupDiagnostics: { authReads, blockedScripts, unexpected, pageErrorCount: errors.length } }))
      throw error
    }
    assert.equal(blockedScripts, 0, "Nonce-protected pages must hydrate without blocked scripts")
    assert.equal(await page.evaluate(() => {
      const inlineScripts = Array.from(document.querySelectorAll("script:not([src])"))
      return inlineScripts.length > 0 && inlineScripts.every(script => Boolean(script.nonce))
    }), true, "Framework inline scripts must receive a request nonce")
    await expect(input).toHaveValue(subject)
    assert.equal(writes.length, 0)
    assert.equal(reads.length, 0, "Opening the route only prefills the UUID")
    await input.fill("fixture@example.invalid")
    await load.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("valid user UUID")
    assert.equal(reads.length, 0)
    await input.fill(subject)
    await load.click()
    await expect(timeline.getByText("CONFIRMED / Version 1", { exact: true })).toBeVisible()
    await expect(timeline.getByText("QIVRO_EMAIL_CHALLENGE", { exact: true })).toBeVisible()
    assert.doesNotMatch(await timeline.innerText(), /PRIVATE_|fixture\.invalid/)
    assert.equal(writes.length, 0)
    pass(`UUID lookup, real metadata and private-field omission ${viewport.width}`)

    await page.getByRole("button", { name: "Older evidence", exact: true }).click()
    await expect(timeline.getByText(olderId, { exact: true })).toBeVisible()
    assert.equal(reads.at(-1).cursor, evidenceId)
    await page.getByRole("button", { name: "Previous evidence", exact: true }).click()
    await expect(timeline.getByText(evidenceId, { exact: true })).toBeVisible()
    assert.equal(reads.at(-1).cursor, null)
    pass(`cursor paging ${viewport.width}`)

    await timeline.getByRole("button", { name: "Revoke evidence", exact: true }).click()
    const confirm = page.getByRole("button", { name: "Confirm revocation", exact: true })
    await expect(confirm).toBeDisabled()
    await page.getByLabel("Revocation reason", { exact: true }).selectOption("SUBJECT_REQUEST")
    await expect(confirm).toBeDisabled()
    await page.getByRole("button", { name: "Cancel revocation", exact: true }).click()
    assert.equal(writes.length, 0)
    await choose()
    acceptDialog = false
    await confirm.click()
    await expect(confirm).toBeEnabled()
    assert.equal(writes.length, 0)
    acceptDialog = true
    writeStatus = 409
    await confirm.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Evidence changed")
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeDisabled()
    assert.equal(writes.length, 1)
    await expect(page.getByText("Revocation recorded. Latest evidence metadata reloaded.", { exact: true })).toHaveCount(0)
    writeStatus = 200
    await reload.click()
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
    await choose()
    const readsBeforeWrite = reads.length
    await confirm.click()
    await expect(timeline.getByText("REVOKED / Version 2", { exact: true })).toBeVisible()
    await expect(timeline.getByText("REVOKED / Version 2 / Admin review", { exact: true })).toBeVisible()
    await expect(page.getByText("Revocation recorded. Latest evidence metadata reloaded.", { exact: true })).toBeVisible()
    assert.ok(reads.length > readsBeforeWrite, "Successful POST must reload metadata")
    assert.deepEqual(writes.at(-1), { expectedVersion: 1, reasonCode: "ADMIN_REVIEW" })
    assert.equal(writes.length, 2)
    assert.ok(dialogCount >= 3)
    assert.doesNotMatch(await timeline.innerText(), /PRIVATE_/)
    pass(`explicit confirmation, conflict lock, reload and authoritative revoke ${viewport.width}`)

    await page.screenshot({ path: path.join(artifacts, `review-${viewport.width}.png`), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No mobile or desktop horizontal overflow")
    record = fixture()
    await reload.click()
    await expect(timeline.getByText("CONFIRMED / Version 1", { exact: true })).toBeVisible()
    readStatus = 503
    await reload.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("disabled or unavailable")
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeDisabled()
    assert.doesNotMatch(await page.getByRole("main").getByRole("alert").innerText(), /PRIVATE_/)
    readStatus = 200
    malformed = true
    await reload.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be validated")
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeDisabled()
    malformed = false
    await reload.click()
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
    pass(`unavailable and schema failures lock stale metadata ${viewport.width}`)

    await choose()
    writeStatus = 503
    await confirm.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("disabled or unavailable")
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeDisabled()
    await expect(page.getByText("Revocation recorded. Latest evidence metadata reloaded.", { exact: true })).toHaveCount(0)
    writeStatus = 200
    await reload.click()
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeEnabled()
    pass(`unavailable mutation does not fabricate success ${viewport.width}`)

    await choose()
    readStatus = 503
    await confirm.click()
    await expect(page.getByText(/Revocation was accepted, but latest metadata could not be reloaded/)).toBeVisible()
    await expect(timeline.getByText("CONFIRMED / Version 1", { exact: true })).toBeVisible()
    await expect(timeline.getByRole("button", { name: "Revoke evidence", exact: true })).toBeDisabled()
    readStatus = 200
    await reload.click()
    await expect(timeline.getByText("REVOKED / Version 2", { exact: true })).toBeVisible()
    pass(`accepted write with failed refresh does not fabricate timeline success ${viewport.width}`)

    // Supersede an in-flight read, then release its old subject metadata.
    let started
    const startedPromise = new Promise((resolve) => { started = resolve })
    delayedStarted = started
    delayedGate = new Promise((resolve) => { releaseDelayed = resolve })
    delayedDone = new Promise((resolve) => { delayedFinished = resolve })
    delayRead = true
    await reload.click()
    await startedPromise
    await input.fill(otherSubject)
    await expect(timeline).toHaveCount(0)
    await load.click()
    await expect(page.getByRole("heading", { name: "No evidence recorded", exact: true })).toBeVisible()
    releaseDelayed()
    await delayedDone
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.getByText(`Subject UUID: ${otherSubject}`, { exact: true })).toBeVisible()
    await expect(timeline).toHaveCount(0)
    assert.equal(reads.at(-1).id, otherSubject)
    pass(`superseded lookup abort and subject-data clearing ${viewport.width}`)

    await input.fill(subject)
    empty = true
    await load.click()
    await expect(page.getByRole("heading", { name: "No evidence recorded", exact: true })).toBeVisible()
    empty = false
    readStatus = 404
    await reload.click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText("not found")
    readStatus = 403
    await reload.click()
    await expect(page).toHaveURL(/\/forbidden$/)
    assert.equal(writes.length, 4)
    assert.deepEqual(unexpected, [])
    assert.deepEqual(errors, [])
    pass(`empty, missing subject and backend-admin denial ${viewport.width}`)
    role = "USER"
    const previousReads = reads.length
    await page.goto(`${base.origin}/trust`)
    await expect(page).toHaveURL(/\/forbidden$/)
    assert.equal(reads.length, previousReads)
    role = "ADMIN"
    authStatus = 401
    await page.goto(`${base.origin}/trust`)
    await expect(page).toHaveURL(/\/login\?reason=session-expired$/)
    assert.equal(reads.length, previousReads)
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    pass(`guarded role and expired session ${viewport.width}`)
    await context.close()
  }
  console.log(`[trust-browser] ${checks} checks passed; screenshots: ${artifacts}`)
} finally {
  await browser.close()
}
