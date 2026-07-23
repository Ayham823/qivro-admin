"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { apiRequest, type OpsAuditLog, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function AuditPage() {
  const router = useRouter()
  const [data, setData] = useState<Paginated<OpsAuditLog> | null>(null)
  const [targetType, setTargetType] = useState("")
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)
  const [error, setError] = useState("")
  const [selectedLog, setSelectedLog] = useState<OpsAuditLog | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({ limit: "25", page: String(page) })
    if (targetType) params.set("targetType", targetType)
    if (action) params.set("action", action)

    apiRequest<Paginated<OpsAuditLog>>(`/admin/audit?${params.toString()}`, { token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit logs"))
  }, [action, page, router, targetType])

  return (
    <GuardedOpsShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Audit Logs
          </p>
          <h1 className="mt-2 text-4xl font-black">Who changed what</h1>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="ops-input" placeholder="Target type" value={targetType} onChange={(event) => setTargetType(event.target.value)} />
          <input className="ops-input" placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading audit logs..." /> : null}
      {data && data.data.length === 0 ? <EmptyBlock title="No audit logs found" /> : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card ops-table-wrap overflow-hidden">
          <table className="ops-table" data-responsive="cards">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((log) => (
                <tr key={log.id}>
                  <td data-label="Action">
                    <strong>{log.action}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td data-label="Target" className="text-sm text-[var(--ops-muted)]">
                    {log.targetType}<br />
                    {log.targetId}
                  </td>
                  <td data-label="Actor" className="text-sm text-[var(--ops-muted)]">
                    {log.actorUserId ?? "system"}
                  </td>
                  <td data-label="Details"><button className="ops-button" onClick={() => setSelectedLog(log)}>Inspect change</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {selectedLog ? <div className="ops-drawer-backdrop" role="presentation" onClick={() => setSelectedLog(null)}><aside className="ops-audit-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4 border-b border-[var(--ops-border)] p-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-accent)]">Audit detail</p><h2 id="audit-detail-title" className="mt-2 text-2xl font-black">{selectedLog.action}</h2><p className="mt-1 text-sm text-[var(--ops-muted)]">{selectedLog.targetType} · {selectedLog.targetId}</p></div><button className="ops-button" onClick={() => setSelectedLog(null)}>Close</button></div><div className="space-y-5 overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="ops-card p-4"><p className="text-xs font-black uppercase text-[var(--ops-muted)]">Actor</p><p className="mt-2 break-all font-bold">{selectedLog.actorUserId ?? "system"}</p></div><div className="ops-card p-4"><p className="text-xs font-black uppercase text-[var(--ops-muted)]">Time</p><p className="mt-2 font-bold">{new Date(selectedLog.createdAt).toLocaleString()}</p></div></div><section><h3 className="font-black text-red-300">Before</h3><pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/35 p-4 text-xs text-[var(--ops-muted)]">{JSON.stringify(selectedLog.beforeJson ?? {}, null, 2)}</pre></section><section><h3 className="font-black text-emerald-300">After</h3><pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/35 p-4 text-xs text-[var(--ops-muted)]">{JSON.stringify(selectedLog.afterJson ?? {}, null, 2)}</pre></section>{selectedLog.metadataJson ? <section><h3 className="font-black">Context</h3><pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/35 p-4 text-xs text-[var(--ops-muted)]">{JSON.stringify(selectedLog.metadataJson, null, 2)}</pre></section> : null}</div></aside></div> : null}

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
