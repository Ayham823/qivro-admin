"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import OpsPageHeader from "@/components/layout/OpsPageHeader"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/ui/StateBlock"
import {
  ApiRequestError,
  getTrustEvidence,
  isTrustEvidenceUuid,
  revokeTrustEvidence,
  TrustEvidenceSchemaError,
  trustRevocationReasons,
  type TrustEvidenceMetadata,
  type TrustEvidencePage,
  type TrustRevocationReason,
} from "@/lib/api"
import { getToken } from "@/lib/auth"
import TrustEvidenceTimeline, { trustReasonLabels } from "./TrustEvidenceTimeline"

type Phase = "idle" | "loading" | "ready" | "stale"

function failureMessage(error: unknown, writing = false) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return "Your session expired. Sign in again to review evidence."
    if (error.status === 403) return "Access denied. An active admin account is required."
    if (error.status === 503) return "Trust evidence is disabled or unavailable. No verification conclusion can be made."
    if (error.status === 404) return "The user or evidence was not found. Reload or check the user UUID."
    if (error.status === 409) return "Evidence changed since it was loaded. Reload latest evidence before reviewing again."
    if (error.status === 429) return "Too many requests. Wait before reloading evidence."
  }
  if (error instanceof TrustEvidenceSchemaError) return error.message
  return writing ? "Revocation could not be confirmed. Reload latest evidence before retrying." : "Could not load evidence. Reload before taking action."
}

export default function TrustEvidenceReview() {
  const [input, setInput] = useState("")
  const [subject, setSubject] = useState("")
  const [page, setPage] = useState<TrustEvidencePage | null>(null)
  const [cursors, setCursors] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [validation, setValidation] = useState("")
  const [notice, setNotice] = useState("")
  const [selected, setSelected] = useState<TrustEvidenceMetadata | null>(null)
  const [reason, setReason] = useState<TrustRevocationReason | "">("")
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const epoch = useRef(0)
  const activeSubject = useRef("")
  const writing = useRef(false)
  const confirmationHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const generation = epoch
    const pendingRequest = request
    const userId = new URLSearchParams(window.location.search).get("userId")
    if (isTrustEvidenceUuid(userId)) setInput(userId)
    return () => {
      generation.current++
      pendingRequest.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (selected) confirmationHeading.current?.focus()
  }, [selected])

  function clearSelection() {
    setSelected(null)
    setReason("")
    setConfirmed(false)
  }

  function changeSubject(value: string) {
    if (writing.current) return
    request.current?.abort()
    epoch.current++
    activeSubject.current = ""
    setInput(value)
    setSubject("")
    setPage(null)
    setCursors([])
    setPhase("idle")
    setError("")
    setValidation("")
    setNotice("")
    clearSelection()
  }

  async function load(userId: string, nextCursors: string[] = [], revoked = false) {
    if (writing.current && !revoked) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const generation = ++epoch.current
    if (activeSubject.current !== userId) setPage(null)
    activeSubject.current = userId
    setSubject(userId)
    setPhase("loading")
    setError("")
    setNotice("")
    clearSelection()
    try {
      const token = getToken()
      if (!token) throw new ApiRequestError("Session required", 401)
      const result = await getTrustEvidence(userId, token, { cursor: nextCursors.at(-1), limit: 20, signal: controller.signal })
      if (controller.signal.aborted || generation !== epoch.current) return
      setPage(result)
      setCursors(nextCursors)
      setPhase("ready")
      if (revoked) setNotice("Revocation recorded. Latest evidence metadata reloaded.")
    } catch (error) {
      if (controller.signal.aborted || generation !== epoch.current) return
      if (error instanceof ApiRequestError && [401, 403].includes(error.status)) setPage(null)
      setPhase("stale")
      setError(failureMessage(error))
      if (revoked) setNotice("Revocation was accepted, but latest metadata could not be reloaded. Do not retry the revocation; reload first.")
    }
  }

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (writing.current) return
    const userId = input.trim().toLowerCase()
    if (!isTrustEvidenceUuid(userId)) {
      changeSubject(input)
      setValidation("Enter a valid user UUID. Email addresses and contact details are not accepted.")
      return
    }
    setValidation("")
    void load(userId)
  }

  async function revoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (writing.current || phase !== "ready" || !selected || !reason || !confirmed || selected.status !== "CONFIRMED") return
    const evidence = selected
    const userId = activeSubject.current
    const generation = epoch.current
    if (!window.confirm(`Revoke evidence ${evidence.id} at version ${evidence.version}? Reason: ${trustReasonLabels[reason]}. This cannot be undone here.`)) return
    writing.current = true
    setSaving(true)
    setNotice("")
    setError("")
    try {
      const token = getToken()
      if (!token) throw new ApiRequestError("Session required", 401)
      await revokeTrustEvidence(evidence.id, token, { expectedVersion: evidence.version, reasonCode: reason })
      if (generation !== epoch.current) return
      // The mutation response is not a substitute for a fresh metadata timeline.
      await load(userId, [], true)
    } catch (error) {
      if (generation !== epoch.current) return
      clearSelection()
      if (error instanceof ApiRequestError && [401, 403].includes(error.status)) setPage(null)
      setPhase("stale")
      setError(failureMessage(error, true))
    } finally {
      writing.current = false
      setSaving(false)
    }
  }

  const busy = saving || phase === "loading"
  return (
    <div className="min-w-0 space-y-6">
      <OpsPageHeader eyebrow="Trust and safety" title="Trust Evidence" description="Email evidence is not identity, ownership, or current-contact verification." />
      <form onSubmit={lookup} className="flex min-w-0 flex-wrap items-end gap-3" aria-label="User evidence lookup">
        <div className="min-w-0 flex-1 basis-72">
          <label htmlFor="trust-user-id" className="mb-2 block text-sm font-bold">User UUID</label>
          <input id="trust-user-id" className="ops-input" value={input} onChange={(event) => changeSubject(event.target.value)} maxLength={36} autoComplete="off" spellCheck={false} disabled={saving} aria-describedby="trust-lookup-help" aria-invalid={Boolean(validation)} />
          <p id="trust-lookup-help" className="mt-2 text-sm text-[var(--ops-muted)]">Use an authorized user UUID. Do not enter contact details.</p>
        </div>
        <button type="submit" className="ops-button ops-button-primary" disabled={busy}>Load evidence</button>
      </form>
      {validation ? <div role="alert"><ErrorBlock message={validation} /></div> : null}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}
      {error ? <div role="alert"><ErrorBlock message={error} /></div> : null}
      {subject ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="break-all text-sm">Subject UUID: <span className="font-mono">{subject}</span></p>
          <button type="button" className="ops-button" disabled={busy} onClick={() => void load(subject)}>Reload latest evidence</button>
        </div>
      ) : null}
      {phase === "idle" ? <EmptyBlock title="Choose a user" description="Evidence review starts with a user UUID." /> : null}
      {phase === "loading" ? <LoadingBlock label="Loading evidence metadata..." /> : null}
      {page && phase !== "ready" ? <p role="status" className="text-sm text-[var(--ops-warning)]">Previously loaded metadata may be stale. Actions are disabled until a successful reload.</p> : null}
      {page && phase === "ready" && page.data.length === 0 ? <EmptyBlock title="No evidence recorded" description="No email evidence was returned. This is not a verification decision." /> : null}
      {selected ? (
        <section className="min-w-0 border-t border-[var(--ops-border)] pt-5" aria-labelledby="trust-revoke-title">
          <h2 id="trust-revoke-title" ref={confirmationHeading} tabIndex={-1} className="text-lg font-bold">Confirm evidence revocation</h2>
          <p className="mt-2 break-all text-sm">Evidence {selected.id} / Expected version {selected.version}</p>
          <p className="mt-2 text-sm text-[var(--ops-muted)]">Revocation is audited and may clear the matching email confirmation. It cannot be undone here.</p>
          <form onSubmit={revoke} className="mt-4 space-y-4">
            <div className="max-w-md">
              <label htmlFor="trust-reason" className="mb-2 block text-sm font-bold">Revocation reason</label>
              <select id="trust-reason" className="ops-input" value={reason} required disabled={busy} onChange={(event) => { setReason(event.target.value as TrustRevocationReason | ""); setConfirmed(false) }}>
                <option value="">Choose a reason</option>
                {trustRevocationReasons.map((value) => <option key={value} value={value}>{trustReasonLabels[value]}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={confirmed} disabled={busy || !reason} onChange={(event) => setConfirmed(event.target.checked)} />
              I confirm revocation of this evidence with the selected reason.
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="ops-button min-w-[180px]" disabled={busy || phase !== "ready" || !reason || !confirmed}>{saving ? "Revoking..." : "Confirm revocation"}</button>
              <button type="button" className="ops-button" disabled={busy} onClick={clearSelection}>Cancel revocation</button>
            </div>
          </form>
        </section>
      ) : null}
      {page && page.data.length > 0 ? (
        <section className="min-w-0" aria-label="Evidence metadata">
          <TrustEvidenceTimeline records={page.data} canRevoke={phase === "ready" && !saving} onRevoke={(evidence) => { clearSelection(); setSelected(evidence) }} />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="ops-button" disabled={busy || phase !== "ready" || cursors.length === 0} onClick={() => void load(subject, cursors.slice(0, -1))}>Previous evidence</button>
            <p className="text-sm text-[var(--ops-muted)]">Page {cursors.length + 1} / Up to 20 records per page</p>
            <button type="button" className="ops-button" disabled={busy || phase !== "ready" || !page.nextCursor} onClick={() => { if (page.nextCursor) void load(subject, [...cursors, page.nextCursor]) }}>Older evidence</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
