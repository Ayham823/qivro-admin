"use client"

import { useEffect, useMemo, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import {
  getTours,
  type OpsTourJobMonitor,
  type OpsTourJobStatus,
  type OpsTourStatus,
  type OpsToursDashboard,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

const publicAppUrl = (
  process.env.NEXT_PUBLIC_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

const statuses: Array<{ value: OpsTourStatus | ""; label: string }> = [
  { value: "", label: "All tours" },
  { value: "UPLOADED", label: "Uploaded" },
  { value: "QUEUED", label: "Queued" },
  { value: "PROCESSING", label: "Processing" },
  { value: "OPTIMIZING", label: "Optimizing" },
  { value: "READY", label: "Ready" },
  { value: "FAILED", label: "Failed" },
  { value: "DELETED", label: "Deleted" },
]

const jobStatuses: Array<{ value: OpsTourJobStatus | ""; label: string }> = [
  { value: "", label: "All jobs" },
  { value: "QUEUED", label: "Queued jobs" },
  { value: "RUNNING", label: "Running jobs" },
  { value: "COMPLETED", label: "Completed jobs" },
  { value: "FAILED", label: "Failed jobs" },
]

function statusClass(status: string) {
  if (status === "READY" || status === "COMPLETED") {
    return "bg-emerald-400/15 text-emerald-200"
  }

  if (status === "FAILED") {
    return "bg-red-400/15 text-red-200"
  }

  if (
    status === "PROCESSING" ||
    status === "OPTIMIZING" ||
    status === "RUNNING"
  ) {
    return "bg-amber-400/15 text-amber-100"
  }

  return "bg-white/5 text-[var(--ops-muted)]"
}

function paramsFor({
  jobStatus,
  q,
  status,
}: {
  jobStatus: OpsTourJobStatus | ""
  q: string
  status: OpsTourStatus | ""
}) {
  const params = new URLSearchParams()

  if (q.trim()) {
    params.set("q", q.trim())
  }

  if (status) {
    params.set("status", status)
  }

  if (jobStatus) {
    params.set("jobStatus", jobStatus)
  }

  return params
}

function formatDate(value?: string | null) {
  if (!value) {
    return "n/a"
  }

  return new Date(value).toLocaleString()
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) {
    return "n/a"
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`
  }

  return `${(seconds / 3600).toFixed(1)}h`
}

function lastLogMessage(logsJson: unknown) {
  if (Array.isArray(logsJson)) {
    const lastLog = [...logsJson].reverse().find(Boolean)

    if (
      typeof lastLog === "object" &&
      lastLog !== null &&
      "message" in lastLog
    ) {
      return String((lastLog as { message?: unknown }).message ?? "")
    }

    return lastLog ? JSON.stringify(lastLog) : ""
  }

  if (logsJson && typeof logsJson === "object") {
    return JSON.stringify(logsJson)
  }

  return ""
}

function JobCard({
  job,
  tone = "default",
}: {
  job: OpsTourJobMonitor
  tone?: "default" | "danger"
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "danger"
          ? "border-red-400/25 bg-red-400/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`ops-pill ${statusClass(job.status)}`}>
            {job.status}
          </span>
          <h3 className="mt-3 font-black">{job.tour.listing.title}</h3>
          <p className="mt-1 text-sm text-[var(--ops-muted)]">
            {job.tour.listing.city} · {job.tour.owner.email}
          </p>
        </div>
        <span className="text-xs font-bold text-[var(--ops-muted)]">
          {formatDate(job.updatedAt)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <p className="flex justify-between gap-4">
          <span className="text-[var(--ops-muted)]">Step</span>
          <strong className="text-right">{job.currentStep ?? "no step"}</strong>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-[var(--ops-muted)]">Tour</span>
          <strong className="max-w-[220px] truncate text-right">
            {job.tour.id}
          </strong>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-[var(--ops-muted)]">Progress</span>
          <strong>{job.tour.progress}%</strong>
        </p>
      </div>

      {job.tour.errorMessage || lastLogMessage(job.logsJson) ? (
        <p
          className={`mt-4 rounded-lg p-3 text-sm leading-6 ${
            tone === "danger"
              ? "bg-black/20 text-red-100"
              : "bg-black/20 text-[var(--ops-muted)]"
          }`}
        >
          {job.tour.errorMessage || lastLogMessage(job.logsJson)}
        </p>
      ) : null}
    </div>
  )
}

export default function ToursPage() {
  const [data, setData] = useState<OpsToursDashboard | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<OpsTourStatus | "">("")
  const [jobStatus, setJobStatus] = useState<OpsTourJobStatus | "">("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null)

  const params = useMemo(
    () => paramsFor({ jobStatus, q, status }),
    [jobStatus, q, status]
  )

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      const token = getToken()

      if (!token) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      const tours = await getTours(token, params)

      if (cancelled) {
        return
      }

      setData(tours)
      setLastLoadedAt(new Date().toISOString())
      setLoading(false)
    }

    loadData().catch((err) => {
      if (cancelled) {
        return
      }

      setLoading(false)
      setError(err instanceof Error ? err.message : "Failed to load tours")
    })

    return () => {
      cancelled = true
    }
  }, [params, refreshKey])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const interval = window.setInterval(() => {
      setRefreshKey((value) => value + 1)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [autoRefresh])

  return (
    <GuardedOpsShell>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            AI Tours Operations
          </p>
          <h1 className="mt-2 text-4xl font-black">3D Tours Monitor</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
            Watch the full tour pipeline: uploaded media, BullMQ jobs, stale
            queue items, failures, ready scenes, and output links for every
            listing.
          </p>
          {lastLoadedAt ? (
            <p className="mt-3 text-xs font-bold text-[var(--ops-muted)]">
              Last updated {formatDate(lastLoadedAt)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search listing, owner, city, tour id"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold outline-none placeholder:text-[var(--ops-muted)] focus:border-[var(--ops-accent)]"
            />
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as OpsTourStatus | "")
              }
              className="rounded-lg border border-white/10 bg-[#101817] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--ops-accent)]"
            >
              {statuses.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={jobStatus}
              onChange={(event) =>
                setJobStatus(event.target.value as OpsTourJobStatus | "")
              }
              className="rounded-lg border border-white/10 bg-[#101817] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--ops-accent)]"
            >
              {jobStatuses.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="ops-button"
            >
              Refresh now
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className="ops-button"
            >
              Auto refresh {autoRefresh ? "on" : "off"}
            </button>
          </div>
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {loading ? <LoadingBlock label="Loading tour operations..." /> : null}

      {data && !loading ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Tours" value={data.summary.total} />
            <KpiCard label="Filtered" value={data.summary.filtered} />
            <KpiCard label="Ready Rate" value={`${data.summary.readyRate}%`} />
            <KpiCard
              label="Avg Completion"
              value={formatDuration(data.summary.averageCompletionSeconds)}
            />
            <KpiCard label="Queued Jobs" value={data.summary.queuedJobs} />
            <KpiCard label="Running Jobs" value={data.summary.processingJobs} />
            <KpiCard label="Stale Jobs" value={data.summary.staleJobs} />
            <KpiCard label="Failed Tours" value={data.summary.failedTours} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Output Health</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Ready with scene</span>
                  <strong>{data.summary.readyWithOutput}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Ready missing scene</span>
                  <strong>{data.summary.readyMissingOutput}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--ops-muted)]">Completed jobs</span>
                  <strong>{data.summary.completedJobs}</strong>
                </p>
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Tours by Status</h2>
              <div className="mt-4 grid gap-2">
                {data.summary.byStatus.map((item) => (
                  <div key={item.value} className="flex justify-between text-sm">
                    <span className="text-[var(--ops-muted)]">{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Jobs by Status</h2>
              <div className="mt-4 grid gap-2">
                {data.summary.jobsByStatus.map((item) => (
                  <div key={item.value} className="flex justify-between text-sm">
                    <span className="text-[var(--ops-muted)]">{item.value}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Recent Failures</h2>
              <p className="mt-2 text-sm text-[var(--ops-muted)]">
                Failed jobs with the latest tour/listing context and error log.
              </p>
              <div className="mt-4 grid gap-3">
                {data.recentFailures.length > 0 ? (
                  data.recentFailures.map((job) => (
                    <JobCard key={job.id} job={job} tone="danger" />
                  ))
                ) : (
                  <p className="rounded-lg bg-white/5 p-4 text-sm font-bold text-[var(--ops-muted)]">
                    No failed jobs right now.
                  </p>
                )}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Recent Job Activity</h2>
              <p className="mt-2 text-sm text-[var(--ops-muted)]">
                Latest queue activity across upload, processing, optimization,
                and completion.
              </p>
              <div className="mt-4 grid gap-3">
                {data.recentJobs.length > 0 ? (
                  data.recentJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))
                ) : (
                  <p className="rounded-lg bg-white/5 p-4 text-sm font-bold text-[var(--ops-muted)]">
                    No queue activity yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          {data.data.length === 0 ? (
            <EmptyBlock
              title="No tours found"
              description="Create and process a listing tour, then it will appear here."
            />
          ) : (
            <section className="ops-card overflow-hidden">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Tour</th>
                    <th>Listing</th>
                    <th>Owner</th>
                    <th>Progress</th>
                    <th>Latest Job</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((tour) => (
                    <tr key={tour.id}>
                      <td>
                        <strong className="block max-w-[180px] truncate">
                          {tour.id}
                        </strong>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`ops-pill ${statusClass(tour.status)}`}>
                            {tour.status}
                          </span>
                          <span className="ops-pill">{tour.inputType}</span>
                        </div>
                        {tour.errorMessage ? (
                          <p className="mt-2 text-sm text-[var(--ops-danger)]">
                            {tour.errorMessage}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <strong>{tour.listing.title}</strong>
                        <p className="mt-1 text-sm text-[var(--ops-muted)]">
                          {tour.listing.city} · ${Number(tour.listing.price).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">
                          {tour.listing.status}
                        </p>
                      </td>
                      <td>
                        <strong>{tour.owner.name ?? "Unknown"}</strong>
                        <p className="mt-1 text-sm text-[var(--ops-muted)]">
                          {tour.owner.email}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">
                          {tour.owner.role} · {tour.owner.plan}
                        </p>
                      </td>
                      <td>
                        <div className="h-3 overflow-hidden rounded bg-white/10">
                          <div
                            className="h-full rounded bg-[var(--ops-accent)]"
                            style={{ width: `${Math.min(100, tour.progress)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-[var(--ops-muted)]">
                          {tour.progress}% · {tour.jobsCount} jobs
                        </p>
                      </td>
                      <td>
                        {tour.latestJob ? (
                          <>
                            <span className={`ops-pill ${statusClass(tour.latestJob.status)}`}>
                              {tour.latestJob.status}
                            </span>
                            <p className="mt-2 text-sm text-[var(--ops-muted)]">
                              {tour.latestJob.currentStep ?? "no step"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--ops-muted)]">
                              {formatDate(tour.latestJob.updatedAt)}
                            </p>
                            {lastLogMessage(tour.latestJob.logsJson) ? (
                              <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs leading-5 text-[var(--ops-muted)]">
                                {lastLogMessage(tour.latestJob.logsJson)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm text-[var(--ops-muted)]">
                            No job yet
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="grid gap-2">
                          <a
                            href={`${publicAppUrl}/listings/${tour.listing.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ops-button text-center"
                          >
                            Listing
                          </a>
                          {tour.inputUrl ? (
                            <a
                              href={tour.inputUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ops-button text-center"
                            >
                              Input
                            </a>
                          ) : null}
                          {tour.outputUrl ? (
                            <a
                              href={tour.outputUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ops-button text-center"
                            >
                              Scene
                            </a>
                          ) : null}
                          {tour.thumbnailUrl ? (
                            <a
                              href={tour.thumbnailUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ops-button text-center"
                            >
                              Thumbnail
                            </a>
                          ) : null}
                          {!tour.inputUrl && !tour.outputUrl && !tour.thumbnailUrl ? (
                            <span className="text-sm text-[var(--ops-muted)]">
                              Waiting for media
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
