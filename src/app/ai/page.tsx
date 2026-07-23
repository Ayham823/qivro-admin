"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  apiRequest,
  updateAiFeedback,
  type OpsAiMetrics,
  type OpsSystemHealth,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function AiPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<OpsAiMetrics | null>(null)
  const [health, setHealth] = useState<OpsSystemHealth | null>(null)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadData = async () => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    const [aiMetrics, systemHealth] = await Promise.all([
      apiRequest<OpsAiMetrics>("/admin/ai/metrics", { token }),
      apiRequest<OpsSystemHealth>("/admin/system/health", { token }),
    ])

    setMetrics(aiMetrics)
    setHealth(systemHealth)
  }

  useEffect(() => {
    loadData().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load AI metrics")
    )
  }, [router])

  const applyFeedback = async (
    requestId: string,
    payload: {
      correctness?: "CORRECT" | "INCORRECT"
      usefulness?: "USEFUL" | "NOT_USEFUL"
      approval?: "APPROVE" | "REJECT"
    },
    successMessage: string
  ) => {
    const token = getToken()
    if (!token) return

    try {
      setBusyId(requestId)
      await updateAiFeedback(token, requestId, payload)
      await loadData()
      showToast(successMessage, "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Feedback update failed", "error")
    } finally {
      setBusyId("")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          AI Control & Observability
        </p>
        <h1 className="mt-2 text-4xl font-black">AI Control</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Monitor AI usage, feedback, review status, latency, failures, and
          backend/database/PostHog health from one operating view.
        </p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!metrics && !error ? <LoadingBlock label="Loading AI intelligence..." /> : null}

      {metrics ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard label="AI Service" value={metrics.health.status} hint={metrics.health.url} />
            <KpiCard label="AI Requests" value={metrics.requests.total} />
            <KpiCard label="Failures" value={metrics.requests.failed} />
            <KpiCard label="P95 Latency" value={`${metrics.requests.latency.p95}ms`} />
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Pending Review" value={metrics.feedback.pending} />
            <KpiCard label="Reviewed" value={metrics.feedback.reviewed} />
            <KpiCard label="Approved" value={metrics.feedback.approved} />
            <KpiCard label="Rejected" value={metrics.feedback.rejected} />
          </section>

          {health ? (
            <section className="grid gap-4 md:grid-cols-3">
              <KpiCard label="Backend" value={health.backend.status} hint={health.backend.environment} />
              <KpiCard label="Database" value={health.database.status} />
              <KpiCard label="PostHog" value={health.posthog.configured ? "configured" : "missing"} hint={health.posthog.host} />
            </section>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Requests by Endpoint</h2>
              <div className="mt-4 grid gap-2">
                {metrics.requests.byEndpoint.map((item) => (
                  <div key={item.value} className="rounded-lg bg-white/5 p-3 text-sm">
                    <strong>{item.value}</strong>
                    <p className="mt-1 text-[var(--ops-muted)]">
                      {item.count} calls · {item.failed} failed · avg {item.avgLatencyMs}ms
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Evaluation Signals</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Accepted events</span>
                  <strong>{metrics.usage.accepted}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Rejected events</span>
                  <strong>{metrics.usage.rejected}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Fallback</span>
                  <strong>{metrics.requests.fallback}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Cache hits</span>
                  <strong>{metrics.requests.cacheHits}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Correct</span>
                  <strong>{metrics.feedback.correct}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Useful</span>
                  <strong>{metrics.feedback.useful}</strong>
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Sources</h2>
              <div className="mt-4 grid gap-2">
                {metrics.sources.map((item) => (
                  <div key={item.value} className="flex justify-between text-sm">
                    <span className="text-[var(--ops-muted)]">{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Actions</h2>
              <div className="mt-4 grid gap-2">
                {metrics.actions.map((item) => (
                  <div key={item.value} className="flex justify-between text-sm">
                    <span className="text-[var(--ops-muted)]">{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ops-card p-5">
            <h2 className="text-xl font-black">AI Endpoints</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {metrics.endpoints.map((endpoint) => (
                <span className="ops-pill" key={endpoint}>{endpoint}</span>
              ))}
            </div>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black">AI Review Table</h2>
                  <p className="mt-2 text-sm text-[var(--ops-muted)]">
                    Recent AI inputs and outputs for manual review and dataset building.
                  </p>
                </div>
                <Link href="/ai/review-queue" className="ops-button">
                  Open Review Queue
                </Link>
              </div>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Input / Output</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.endpoint}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {request.latencyMs}ms · {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td>
                      <span className="ops-pill">{request.success ? "success" : "failed"}</span>
                      {request.feedback ? (
                        <p className="mt-2 text-sm text-[var(--ops-muted)]">
                          {request.feedback.correctness ?? "unrated"} · {request.feedback.usefulness ?? "unrated"} · {request.feedback.approval ?? "unrated"}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--ops-warning)]">Pending review</p>
                      )}
                      {request.errorMessage ? (
                        <p className="mt-2 text-sm text-[var(--ops-danger)]">
                          {request.errorMessage}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <pre className="max-h-56 max-w-2xl overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                        {JSON.stringify(
                          {
                            input: request.inputJson,
                            output: request.outputJson,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { correctness: "CORRECT" }, "Marked as correct.")}
                        >
                          Correct
                        </button>
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { correctness: "INCORRECT" }, "Marked as incorrect.")}
                        >
                          Incorrect
                        </button>
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { usefulness: "USEFUL" }, "Marked as useful.")}
                        >
                          Useful
                        </button>
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { usefulness: "NOT_USEFUL" }, "Marked as not useful.")}
                        >
                          Not useful
                        </button>
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { approval: "APPROVE" }, "Approved output.")}
                        >
                          Approve
                        </button>
                        <button
                          className="ops-button"
                          disabled={busyId === request.id}
                          onClick={() => applyFeedback(request.id, { approval: "REJECT" }, "Rejected output.")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">AI Product Events</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.type}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="text-sm text-[var(--ops-muted)]">
                      {event.entityType ?? "none"}<br />
                      {event.entityId ?? ""}
                    </td>
                    <td>
                      <pre className="max-w-xl overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                        {JSON.stringify(event.metadata ?? {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
