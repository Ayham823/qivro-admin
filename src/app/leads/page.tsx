"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { apiRequest, type OpsLead, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

type LeadsResponse = Paginated<OpsLead> & {
  summary: Array<{ value: string; count: number }>
}

export default function LeadsPage() {
  const router = useRouter()
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({ limit: "25", page: String(page) })
    if (q) params.set("q", q)
    if (status) params.set("status", status)

    apiRequest<LeadsResponse>(`/admin/leads?${params.toString()}`, { token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"))
  }, [page, q, router, status])

  return (
    <GuardedOpsShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Leads & CRM Monitor
          </p>
          <h1 className="mt-2 text-4xl font-black">Leads</h1>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="ops-input"
            placeholder="Search lead, phone, listing..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <select className="ops-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading leads..." /> : null}

      {data && data.data.length === 0 ? <EmptyBlock title="No leads found" /> : null}

      {data && data.data.length > 0 ? (
        <div className="space-y-5">
          <section className="grid gap-3 md:grid-cols-3">
            {data.summary.map((item) => (
              <div key={item.value} className="ops-card p-5">
                <p className="text-sm text-[var(--ops-muted)]">{item.value}</p>
                <p className="mt-2 text-3xl font-black">{item.count}</p>
              </div>
            ))}
          </section>

          <section className="ops-card overflow-hidden">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Listing</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.name}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {lead.phone} · {lead.source ?? "unknown source"}
                      </p>
                      <p className="mt-2 max-w-md text-sm text-[var(--ops-muted)]">
                        {lead.message}
                      </p>
                    </td>
                    <td>
                      <strong>{lead.listing.title}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {lead.listing.city} · ${Number(lead.listing.price).toLocaleString()}
                      </p>
                    </td>
                    <td>
                      <strong>{lead.owner.email}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {lead.owner.name ?? "No name"}
                      </p>
                    </td>
                    <td>
                      <span className="ops-pill">{lead.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {data ? (
        <div className="mt-5 flex items-center justify-between">
          <button className="ops-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Previous
          </button>
          <span className="text-sm font-bold text-[var(--ops-muted)]">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <button className="ops-button" disabled={page >= data.meta.totalPages} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
