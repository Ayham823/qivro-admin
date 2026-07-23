"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import { apiRequest, type OpsModerationReport, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

type ReportsResponse = Paginated<OpsModerationReport> & {
  summary: Array<{ value: string; count: number }>
}

const statuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]

export default function ModerationReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<ReportsResponse | null>(null)
  const [reviewStatus, setReviewStatus] = useState("OPEN")
  const [page, setPage] = useState(1)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const { showToast, ToastHost } = useToast()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({ limit: "25", page: String(page) })
    if (reviewStatus) params.set("reviewStatus", reviewStatus)

    apiRequest<ReportsResponse>(`/admin/moderation/reports?${params.toString()}`, { token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
  }, [page, refreshKey, reviewStatus, router])

  const updateReport = async (id: string, nextStatus: string) => {
    const adminNotes = window.prompt("Admin note for this moderation decision", "")
    if (adminNotes === null) return

    const token = getToken()
    if (!token) return

    try {
      await apiRequest(`/admin/moderation/reports/${id}`, {
        method: "PATCH",
        token,
        body: {
          reviewStatus: nextStatus,
          adminNotes,
        },
      })
      showToast("Moderation report updated.", "success")
      setRefreshKey((value) => value + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "error")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Fraud / Trust Center
          </p>
          <h1 className="mt-2 text-4xl font-black">Moderation Reports</h1>
        </div>
        <select className="ops-input max-w-xs" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading moderation reports..." /> : null}

      {data ? (
        <section className="mb-5 grid gap-3 md:grid-cols-4">
          {data.summary.map((item) => (
            <div key={item.value} className="ops-card p-4">
              <p className="text-sm text-[var(--ops-muted)]">{item.value}</p>
              <p className="mt-1 text-2xl font-black">{item.count}</p>
            </div>
          ))}
        </section>
      ) : null}

      {data && data.data.length === 0 ? <EmptyBlock title="No reports found" /> : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card ops-table-wrap overflow-hidden">
          <table className="ops-table" data-responsive="cards">
            <thead>
              <tr>
                <th>Report</th>
                <th>Listing</th>
                <th>Reporter</th>
                <th>Workflow</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((report) => (
                <tr key={report.id}>
                  <td data-label="Report">
                    <span className="ops-pill">{report.reason}</span>
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">
                      {report.message ?? "No message"}
                    </p>
                  </td>
                  <td data-label="Listing">
                    <strong>{report.listing.title}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {report.listing.city} · {report.listing.status} · owner {report.listing.createdBy.email}
                    </p>
                  </td>
                  <td data-label="Reporter" className="text-sm text-[var(--ops-muted)]">
                    {report.user?.email ?? report.sessionId ?? "anonymous"}
                  </td>
                  <td data-label="Workflow">
                    <p className="mb-2 text-sm font-bold">{report.reviewStatus}</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="ops-button" onClick={() => updateReport(report.id, "UNDER_REVIEW")}>Review</button>
                      <button className="ops-button" onClick={() => updateReport(report.id, "RESOLVED")}>Resolve</button>
                      <button className="ops-button" onClick={() => updateReport(report.id, "DISMISSED")}>Dismiss</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {data && data.meta.totalPages > 1 ? <div className="mt-5 flex items-center justify-between"><button className="ops-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span className="text-sm font-bold text-[var(--ops-muted)]">Page {data.meta.page} of {data.meta.totalPages}</span><button className="ops-button" disabled={page >= data.meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div> : null}
    </GuardedOpsShell>
  )
}
