import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Browser tooling is supplied by the caller; no new runtime or package install.
const require = createRequire(import.meta.url)
if (!process.env.QIVRO_PLAYWRIGHT_MODULE) throw new Error("Set QIVRO_PLAYWRIGHT_MODULE to an installed @playwright/test module")
const { chromium, expect } = require(process.env.QIVRO_PLAYWRIGHT_MODULE)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const preview = mkdtempSync(path.join(os.tmpdir(), "qivro-admin-building-test-"))
const artifacts = path.join(root, "test-results/building-links")
mkdirSync(artifacts, { recursive: true })
for (const item of ["src", "public", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "sentry.server.config.ts", "sentry.edge.config.ts", "sentry.client.config.ts"])
  if (existsSync(path.join(root, item))) cpSync(path.join(root, item), path.join(preview, item), { recursive: true })
symlinkSync(path.join(root, "node_modules"), path.join(preview, "node_modules"), "dir")
const probe = createServer()
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve))
const port = probe.address().port
await new Promise((resolve) => probe.close(resolve))
const url = `http://127.0.0.1:${port}`
const env = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_APP_ENV: "local", NEXT_PUBLIC_API_URL: "http://127.0.0.1:9/api", NEXT_PUBLIC_BROWSER_API_URL: `${url}/api` }
const next = (args) => spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), ...args], { cwd: preview, env, stdio: "inherit" })
const completed = (child) => new Promise((resolve, reject) => {
  child.once("error", reject)
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Next exited ${code}`)))
})
let server, browser
try {
  console.log(`[admin-buildings] isolated build without .env files: ${preview}`)
  await completed(next(["build", "--webpack"]))
  server = next(["start", "--hostname", "127.0.0.1", "--port", String(port)])
  let ready = false
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${url}/login`)).ok) { ready = true; break } } catch {}
    if (server.exitCode !== null) throw new Error("Preview exited before readiness")
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, "Admin preview must start")
  browser = await chromium.launch({ headless: true })
  const listingId = "10000000-0000-4000-8000-000000000001"
  const route = `/listings/${listingId}/building`
  const endpoint = `/api/admin/geo/v1/listings/${listingId}/building`
  let checks = 0
  const pass = (name) => { checks++; console.log(`[admin-buildings] PASS ${name}`) }
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    let role = "ADMIN", unavailable = false, conflict = false, failRead = false
    let link = null
    const reviews = [], writes = []
    let reviewReads = 0
    await page.route("**/api/**", async (request) => {
      const requestUrl = new URL(request.request().url())
      const pathname = requestUrl.pathname
      const respond = (data, status = 200) => request.fulfill({ status, json: { success: status === 200, data, error: status === 200 ? undefined : { message: "Synthetic request failure" } } })
      if (pathname === "/api/auth/me") return respond({ id: "fixture-admin", email: "admin@fixture.invalid", role })
      if (pathname === "/api/geo/v1/places") return respond({ places: [{ id: "green-diamond-tbilisi", name: "Green Diamond, Tbilisi", kind: "project" }] })
      if (pathname.endsWith("/places/green-diamond-tbilisi/buildings")) return respond({ features: [{ id: "osm-way-786826644", properties: { name: "Building D2", sourceUrl: "https://www.openstreetmap.org/way/786826644", sourceVersion: 4, sourceModifiedAt: "2026-09-01T00:00:00Z", street: "Fixture Street", houseNumber: "32" } }] })
      if (pathname === endpoint && request.request().method() === "GET") {
        reviewReads++
        return respond({ listing: { id: listingId, title: "Synthetic reviewed home", city: "Tbilisi", status: "PUBLISHED", availabilityStatus: "AVAILABLE" }, link, reviews: [...reviews].reverse(), historyLimit: 20 }, unavailable ? 404 : failRead ? 500 : 200)
      }
      if ([endpoint, `${endpoint}/withdraw`].includes(pathname)) {
        const body = request.request().postDataJSON()
        writes.push({ pathname, method: request.request().method(), body })
        if (conflict) return respond(null, 409)
        assert.equal(body.expectedVersion, link?.version ?? 0)
        const withdrawal = pathname.endsWith("/withdraw")
        if (withdrawal) assert.deepEqual(Object.keys(body).sort(), ["expectedVersion", "note"])
        if (!withdrawal && body.published) assert.equal(body.publicationConsentConfirmed, true)
        link = { ...link, listingId, placeId: body.placeId ?? link.placeId, buildingId: body.buildingId ?? link.buildingId, sourceVersion: 4, published: withdrawal ? false : body.published, version: body.expectedVersion + 1 }
        reviews.push({ ...link, action: withdrawal ? "WITHDRAW" : "REVIEW", note: body.note, consentConfirmed: !withdrawal && body.publicationConsentConfirmed, createdAt: "2026-09-18T12:00:00Z" })
        return respond(link)
      }
      return respond([])
    })
    await page.goto(`${url}${route}`)
    await expect(page.getByRole("heading", { name: "Building link review" })).toBeVisible()
    await expect(page.getByText("Synthetic reviewed home", { exact: true })).toBeVisible()
    const review = page.getByRole("region", { name: "Building link review", exact: true })
    const save = page.getByRole("button", { name: "Save review", exact: true })
    await page.getByLabel("Building", { exact: true }).selectOption("osm-way-786826644")
    await page.getByLabel("Evidence reference / review note").fill("Authorized synthetic evidence TEST-1")
    await expect(save).toBeDisabled()
    await page.getByLabel("I verified this building association against authorized evidence.").check()
    await save.click()
    await expect(page.getByText("Version 1 · Private association", { exact: true })).toBeVisible()
    assert.equal(writes.at(-1).method, "PUT")
    assert.equal(writes.at(-1).body.published, false)
    pass(`private review and version refresh ${viewport.width}`)
    await page.getByLabel("Evidence reference / review note").fill("Authorized publication evidence TEST-2")
    await page.getByLabel("I verified this building association against authorized evidence.").check()
    await page.getByLabel("Publish the exact building association", { exact: true }).check()
    await expect(save).toBeDisabled()
    await page.getByLabel("I confirmed permission from the appropriate owner to disclose this exact building.").check()
    await save.click()
    await expect(page.getByText("Version 2 · Publication approved", { exact: true })).toBeVisible()
    await expect(page.getByLabel("I confirmed permission from the appropriate owner to disclose this exact building.")).not.toBeChecked()
    pass(`explicit publication consent ${viewport.width}`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(artifacts, `review-${viewport.width}.png`), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow")
    conflict = true
    await page.getByLabel("Evidence reference / review note").fill("Synthetic outdated review TEST-3")
    await page.getByLabel("I verified this building association against authorized evidence.").check()
    await page.getByLabel("I confirmed permission from the appropriate owner to disclose this exact building.").check()
    await save.click()
    await expect(review.getByRole("alert")).toContainText("Another review changed")
    await expect(save).toBeDisabled()
    conflict = false
    await page.getByRole("button", { name: "Reload latest review" }).click()
    await expect(review.getByRole("alert")).toHaveCount(0)
    await page.getByLabel("Evidence reference / review note").fill("Synthetic owner consent withdrawn TEST-4")
    await page.getByRole("button", { name: "Withdraw publication" }).click()
    await expect(page.getByText("Version 3 · Private association", { exact: true })).toBeVisible()
    await expect(page.getByText(/Version 3 · WITHDRAW/)).toBeVisible()
    pass(`conflict lock, reload and withdrawal ${viewport.width}`)
    failRead = true
    await page.getByRole("button", { name: "Reload latest review" }).click()
    await expect(review.getByRole("alert")).toContainText("Could not load the latest review")
    await expect(save).toBeDisabled()
    failRead = false
    unavailable = true
    await page.getByRole("button", { name: "Reload latest review" }).click()
    await expect(review.getByRole("alert")).toContainText("Building review is unavailable")
    pass(`failed refresh and disabled feature ${viewport.width}`)
    role = "USER"
    const readCount = reviewReads
    await page.goto(`${url}${route}`)
    await expect(page).toHaveURL(/\/forbidden/)
    assert.equal(reviewReads, readCount, "Non-admin must not mount review requests")
    assert.deepEqual(errors, [])
    pass(`non-admin blocked before loading review ${viewport.width}`)
    await context.close()
  }
  console.log(`[admin-buildings] ${checks} browser checks passed; screenshots: ${artifacts}`)
} catch (error) {
  if (browser) {
    let index = 0
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: path.join(artifacts, `failure-${index}.png`), fullPage: true }).catch(() => {})
      writeFileSync(path.join(artifacts, `failure-${index}.html`), await page.content().catch(() => ""))
      index++
    }
  }
  throw error
} finally {
  try { await browser?.close() } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve))
      server.kill("SIGTERM")
      await exited
    }
  }
}
