"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import GuardedOpsShell from "@/components/layout/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/ui/StateBlock"
import { useToast } from "@/components/ui/Toast"
import {
  getAiMediaReviewDetail,
  getAiMediaReviewQueue,
  reviewAiMediaJob,
  type OpsAiMediaReviewDecision,
  type OpsAiMediaReviewDetail,
  type OpsAiMediaReviewQueue,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

const reviewStatuses = [
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "FAILED",
]

const reasonCodes = [
  "QUALITY_TOO_LOW",
  "DISTORTION",
  "POLICY_RISK",
  "WRONG_STYLE",
  "INCOMPLETE",
  "OTHER",
]

export default function AiMediaReviewPage() {
  const [queue, setQueue] = useState<OpsAiMediaReviewQueue | null>(null)
  const [detail, setDetail] = useState<OpsAiMediaReviewDetail | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("NEEDS_REVIEW")
  const [provider, setProvider] = useState("")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [reasonCode, setReasonCode] = useState("QUALITY_TOO_LOW")
  const [note, setNote] = useState("")
  const [alternateProvider, setAlternateProvider] = useState("")
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busyDecision, setBusyDecision] = useState("")
  const [error, setError] = useState("")
  const [detailError, setDetailError] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadQueue = useCallback(async () => {
    const token = getToken()
    if (!token) return

    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      status,
      sort: "createdAt",
      order: "desc",
    })
    if (provider) params.set("provider", provider)
    if (search.trim()) params.set("q", search.trim())

    setLoadingQueue(true)
    setError("")
    try {
      setQueue(await getAiMediaReviewQueue(token, params))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media review queue failed")
    } finally {
      setLoadingQueue(false)
    }
  }, [page, provider, search, status])

  const loadDetail = useCallback(async (jobId: string) => {
    const token = getToken()
    if (!token) return

    setSelectedId(jobId)
    setLoadingDetail(true)
    setDetailError("")
    try {
      const nextDetail = await getAiMediaReviewDetail(token, jobId)
      setDetail(nextDetail)
      setAlternateProvider(nextDetail.alternateProviders[0] ?? "")
      setReasonCode("QUALITY_TOO_LOW")
      setNote("")
    } catch (err) {
      setDetail(null)
      setDetailError(
        err instanceof Error ? err.message : "Media review detail failed"
      )
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0)
    return () => window.clearTimeout(timer)
  }, [loadQueue])

  const runDecision = async (decision: OpsAiMediaReviewDecision) => {
    const token = getToken()
    if (!token || !detail) return

    if (decision === "REJECT" && !reasonCode) {
      showToast("Select a rejection reason.", "error")
      return
    }
    if (decision === "MARK_MISLEADING" && !note.trim()) {
      showToast("Add a note explaining what is misleading.", "error")
      return
    }
    if (decision === "RETRY_OTHER_PROVIDER" && !alternateProvider) {
      showToast("No alternate provider is configured.", "error")
      return
    }

    const confirmation: Record<OpsAiMediaReviewDecision, string> = {
      APPROVE: "Approve this AI media result for the next review step?",
      REJECT: "Reject this result and close this job?",
      RETRY: "Reject this result and create a new retry job?",
      RETRY_OTHER_PROVIDER:
        "Reject this result and retry with the selected provider?",
      MARK_MISLEADING:
        "Mark this result as misleading and reject it? This is audited.",
      PUBLISH: "Publish this approved AI media result? This is audited.",
    }
    if (!window.confirm(confirmation[decision])) return

    setBusyDecision(decision)
    try {
      const result = await reviewAiMediaJob(token, detail.id, {
        decision,
        idempotencyKey: crypto.randomUUID(),
        ...(decision === "REJECT" ? { reasonCode } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(decision === "RETRY_OTHER_PROVIDER"
          ? { providerPreference: alternateProvider }
          : {}),
      })
      showToast(
        result.retryJob
          ? `Retry job ${result.retryJob.id} created.`
          : `Decision ${decision.toLowerCase()} saved.`,
        "success"
      )
      await Promise.all([loadQueue(), loadDetail(detail.id)])
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Review action failed", "error")
    } finally {
      setBusyDecision("")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <header className="mb-6">
        <p className="text-xs font-black uppercase text-[var(--ops-accent)]">
          Human publication gate
        </p>
        <h1 className="mt-2 text-4xl font-black">AI Media Review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Compare stored source media with generated outputs, inspect quality and
          cost, then record an audited decision. Mock outputs cannot be published.
        </p>
      </header>

      {queue ? (
        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {reviewStatuses.map((value) => (
            <button
              key={value}
              type="button"
              className={`ops-card p-4 text-left ${
                status === value ? "border-emerald-400/60" : ""
              }`}
              onClick={() => {
                setPage(1)
                setStatus(value)
              }}
            >
              <span className="block text-xs font-bold text-[var(--ops-muted)]">
                {humanize(value)}
              </span>
              <strong className="mt-1 block text-2xl">
                {queue.meta.statusCounts[value] ?? 0}
              </strong>
            </button>
          ))}
        </section>
      ) : null}

      <section className="ops-card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
        <input
          className="ops-input"
          value={search}
          placeholder="Search job, listing, city, or owner"
          onChange={(event) => {
            setPage(1)
            setSearch(event.target.value)
          }}
        />
        <select
          className="ops-input"
          value={provider}
          onChange={(event) => {
            setPage(1)
            setProvider(event.target.value)
          }}
        >
          <option value="">All providers</option>
          {(queue?.meta.availableProviders ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="ops-button" type="button" onClick={() => void loadQueue()}>
          Refresh
        </button>
      </section>

      {error ? (
        <div className="mb-5 space-y-3">
          <ErrorBlock message={error} />
          <button className="ops-button" type="button" onClick={() => void loadQueue()}>
            Retry queue
          </button>
        </div>
      ) : null}
      {loadingQueue && !queue ? (
        <LoadingBlock label="Loading AI media review queue..." />
      ) : null}
      {!loadingQueue && queue?.data.length === 0 ? (
        <EmptyBlock
          title="No media jobs matched"
          description="Change the status or filters, or wait for a new AI media result."
        />
      ) : null}

      {queue && queue.data.length > 0 ? (
        <section className="ops-card overflow-x-auto">
          <table className="ops-table min-w-[980px]">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Status</th>
                <th>Quality</th>
                <th>Provider</th>
                <th>Cost</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.data.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>{job.listing?.title ?? "Listing unavailable"}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {job.listing?.city ?? "Unknown city"} / {job.mediaType ?? "Media"}
                    </p>
                    <p className="mt-1 max-w-64 truncate text-xs text-[var(--ops-muted)]">
                      {job.owner?.email ?? job.id}
                    </p>
                  </td>
                  <td>
                    <span className="ops-pill">{humanize(job.status)}</span>
                  </td>
                  <td>{formatScore(job.qualityScore)}</td>
                  <td>
                    <strong>{job.provider ?? "not recorded"}</strong>
                    <p className="mt-1 text-xs text-[var(--ops-muted)]">
                      {job.model ?? "model pending"}
                    </p>
                  </td>
                  <td>{formatCost(job.totalCostMicros)}</td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() => void loadDetail(job.id)}
                    >
                      {selectedId === job.id ? "Reload" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {queue ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            className="ops-button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="text-sm font-bold text-[var(--ops-muted)]">
            Page {queue.meta.page} of {queue.meta.totalPages}
          </span>
          <button
            className="ops-button"
            disabled={page >= queue.meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <div className="mt-8">
        {loadingDetail ? <LoadingBlock label="Signing private source previews..." /> : null}
        {detailError ? (
          <div className="space-y-3">
            <ErrorBlock message={detailError} />
            {selectedId ? (
              <button
                className="ops-button"
                type="button"
                onClick={() => void loadDetail(selectedId)}
              >
                Retry detail
              </button>
            ) : null}
          </div>
        ) : null}
        {!loadingDetail && detail ? (
          <ReviewDetail
            detail={detail}
            reasonCode={reasonCode}
            note={note}
            alternateProvider={alternateProvider}
            busyDecision={busyDecision}
            onReasonChange={setReasonCode}
            onNoteChange={setNote}
            onProviderChange={setAlternateProvider}
            onDecision={(decision) => void runDecision(decision)}
          />
        ) : null}
      </div>
    </GuardedOpsShell>
  )
}

function ReviewDetail({
  detail,
  reasonCode,
  note,
  alternateProvider,
  busyDecision,
  onReasonChange,
  onNoteChange,
  onProviderChange,
  onDecision,
}: {
  detail: OpsAiMediaReviewDetail
  reasonCode: string
  note: string
  alternateProvider: string
  busyDecision: string
  onReasonChange: (value: string) => void
  onNoteChange: (value: string) => void
  onProviderChange: (value: string) => void
  onDecision: (decision: OpsAiMediaReviewDecision) => void
}) {
  const canReview = detail.status === "NEEDS_REVIEW"
  const canReject = canReview || detail.status === "APPROVED"
  const canRetry = canReview || detail.status === "REJECTED"

  return (
    <section className="space-y-5">
      <div className="ops-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--ops-accent)]">
              Review job {detail.id}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {detail.listing?.title ?? "Listing unavailable"}
            </h2>
            <p className="mt-2 text-sm text-[var(--ops-muted)]">
              {detail.mediaType} / {detail.style} / {detail.provider ?? "provider pending"}
            </p>
          </div>
          <div className="text-right">
            <span className="ops-pill">{humanize(detail.status)}</span>
            <p className="mt-2 text-sm text-[var(--ops-muted)]">
              Quality {formatScore(detail.qualityScore)} / {formatCost(detail.totalCostMicros)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="ops-card p-5">
          <h3 className="text-xl font-black">Original media</h3>
          <p className="mt-2 text-sm text-[var(--ops-muted)]">
            Private previews expire automatically. They are never stored in the admin UI.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {detail.originalMedia.map((media) => (
              <div key={media.mediaId} className="overflow-hidden rounded-lg border border-white/10">
                <MediaPreview
                  url={media.accessUrl}
                  mimeType={media.mimeType}
                  label={`Original media ${media.sortOrder + 1}`}
                />
                <div className="p-3 text-xs text-[var(--ops-muted)]">
                  {media.kind} / {formatBytes(media.sizeBytes)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ops-card p-5">
          <h3 className="text-xl font-black">AI outputs</h3>
          <div className="mt-4 space-y-4">
            {detail.outputs.map((output) => (
              <div key={output.id} className="rounded-lg border border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>{humanize(output.kind)}</strong>
                  <span className="ops-pill">
                    {output.isPrimary ? "Primary" : `Version ${output.version}`}
                  </span>
                </div>
                {output.renderable && output.previewUrl ? (
                  <div className="mt-3 overflow-hidden rounded-lg">
                    <MediaPreview
                      url={output.previewUrl}
                      mimeType={output.mimeType ?? ""}
                      label={output.kind}
                    />
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">
                    This contract output has no renderable artifact. Mock output is kept for
                    workflow testing and cannot be published.
                  </p>
                )}
                <p className="mt-3 text-sm text-[var(--ops-muted)]">
                  Quality {formatScore(output.qualityScore)} / Publishable {output.publishable ? "yes" : "no"}
                </p>
                {output.warnings.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                    {output.warnings.map((warning, index) => (
                      <li key={`${output.id}-${index}`}>{String(warning)}</li>
                    ))}
                  </ul>
                ) : null}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold">Output contract</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                    {JSON.stringify(output.payload, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ops-card p-5">
        <h3 className="text-xl font-black">Decision</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_220px]">
          <select
            className="ops-input"
            value={reasonCode}
            onChange={(event) => onReasonChange(event.target.value)}
          >
            {reasonCodes.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
          <textarea
            className="ops-input min-h-24 resize-y"
            value={note}
            maxLength={2000}
            placeholder="Reviewer note"
            onChange={(event) => onNoteChange(event.target.value)}
          />
          <select
            className="ops-input"
            value={alternateProvider}
            disabled={detail.alternateProviders.length === 0}
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {detail.alternateProviders.length === 0 ? (
              <option value="">No alternate provider</option>
            ) : null}
            {detail.alternateProviders.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            label="Approve"
            decision="APPROVE"
            disabled={!canReview}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
          <ActionButton
            label="Reject"
            decision="REJECT"
            disabled={!canReject}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
          <ActionButton
            label="Retry"
            decision="RETRY"
            disabled={!canRetry}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
          <ActionButton
            label="Retry with another provider"
            decision="RETRY_OTHER_PROVIDER"
            disabled={!canRetry || detail.alternateProviders.length === 0}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
          <ActionButton
            label="Mark misleading"
            decision="MARK_MISLEADING"
            disabled={!canReject}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
          <ActionButton
            label="Publish"
            decision="PUBLISH"
            disabled={detail.status !== "APPROVED" || !detail.canPublish}
            busyDecision={busyDecision}
            onDecision={onDecision}
          />
        </div>
        {!detail.canPublish ? (
          <p className="mt-3 text-sm text-amber-100">
            Publication remains locked until a non-mock provider returns an explicitly
            publishable primary artifact.
          </p>
        ) : null}
      </section>

      <section className="ops-card overflow-x-auto">
        <table className="ops-table min-w-[760px]">
          <thead>
            <tr>
              <th>Decision history</th>
              <th>Reviewer</th>
              <th>Reason</th>
              <th>Retry job</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {detail.reviews.length === 0 ? (
              <tr>
                <td colSpan={5}>No decisions recorded yet.</td>
              </tr>
            ) : (
              detail.reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{humanize(review.decision)}</strong>
                    <p className="mt-1 text-xs text-[var(--ops-muted)]">
                      {humanize(review.fromStatus)} -&gt; {humanize(review.toStatus)}
                    </p>
                  </td>
                  <td>{review.actor?.email ?? "Unknown reviewer"}</td>
                  <td>{review.reasonCode ? humanize(review.reasonCode) : review.note ?? "-"}</td>
                  <td>{review.retryJob?.id ?? "-"}</td>
                  <td>{new Date(review.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </section>
  )
}

function ActionButton({
  label,
  decision,
  disabled,
  busyDecision,
  onDecision,
}: {
  label: string
  decision: OpsAiMediaReviewDecision
  disabled: boolean
  busyDecision: string
  onDecision: (decision: OpsAiMediaReviewDecision) => void
}) {
  return (
    <button
      type="button"
      className="ops-button"
      disabled={disabled || Boolean(busyDecision)}
      onClick={() => onDecision(decision)}
    >
      {busyDecision === decision ? "Working..." : label}
    </button>
  )
}

function MediaPreview({
  url,
  mimeType,
  label,
}: {
  url: string
  mimeType: string
  label: string
}) {
  if (mimeType.startsWith("image/")) {
    return (
      <Image
        src={url}
        alt={label}
        width={640}
        height={360}
        unoptimized
        className="aspect-video w-full object-cover"
      />
    )
  }
  if (mimeType.startsWith("video/")) {
    return <video src={url} controls preload="metadata" className="aspect-video w-full" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block p-4 text-sm font-bold text-[var(--ops-accent)]"
    >
      Open source media
    </a>
  )
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatScore(value?: number | null) {
  return value === null || value === undefined ? "Not scored" : `${value.toFixed(1)}/100`
}

function formatCost(micros: number) {
  return `$${(micros / 1_000_000).toFixed(4)}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
