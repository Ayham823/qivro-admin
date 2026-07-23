"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import { apiRequest, type OpsListing, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

const statuses = ["PUBLISHED", "DRAFT", "ARCHIVED"]
const SAVED_VIEWS_KEY = "qivro:admin:listings-saved-views"

type SavedView = { id: string; name: string; q: string; status: string; sort: string }

export default function ListingsPage() {
  const router = useRouter()
  const [data, setData] = useState<Paginated<OpsListing> | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState("created_desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState("ARCHIVED")
  const [bulkPending, setBulkPending] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [viewName, setViewName] = useState("")
  const { showToast, ToastHost } = useToast()

  useEffect(() => {
    try {
      setSavedViews(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) ?? "[]") as SavedView[])
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({ limit: "25", page: String(page), sort })
    if (q) params.set("q", q)
    if (status) params.set("status", status)

    apiRequest<Paginated<OpsListing>>(`/admin/listings?${params.toString()}`, {
      token,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load listings"))
  }, [page, q, refreshKey, router, sort, status])

  const action = async (listingId: string, nextStatus: string) => {
    if (!window.confirm(`Confirm changing listing status to ${nextStatus}?`)) {
      return
    }

    const token = getToken()
    if (!token) return

    try {
      await apiRequest(`/admin/listings/${listingId}/status`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      })
      showToast("Listing status updated.", "success")
      setRefreshKey((value) => value + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "error")
    }
  }

  const bulkAction = async () => {
    const token = getToken()
    if (!token || selectedIds.length === 0) return
    if (!window.confirm(`Change ${selectedIds.length} listings to ${bulkStatus}?`)) return
    try {
      setBulkPending(true)
      await Promise.all(selectedIds.map((listingId) => apiRequest(`/admin/listings/${listingId}/status`, { method: "PATCH", token, body: { status: bulkStatus } })))
      showToast(`${selectedIds.length} listings updated.`, "success")
      setSelectedIds([])
      setRefreshKey((value) => value + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk action failed", "error")
    } finally {
      setBulkPending(false)
    }
  }

  const saveCurrentView = () => {
    const name = viewName.trim()
    if (!name) return
    const next = [...savedViews.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), { id: crypto.randomUUID(), name, q, status, sort }]
    setSavedViews(next)
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next))
    setViewName("")
    showToast("Saved view created.", "success")
  }

  const applySavedView = (id: string) => {
    const view = savedViews.find((item) => item.id === id)
    if (!view) return
    setQ(view.q); setStatus(view.status); setSort(view.sort); setPage(1)
  }

  const feature = async (listingId: string, type: "FEATURED" | "BOOSTED") => {
    if (!window.confirm(`Confirm ${type.toLowerCase()} for 14 days?`)) {
      return
    }

    const token = getToken()
    if (!token) return

    try {
      await apiRequest(`/admin/listings/${listingId}/feature`, {
        method: "POST",
        token,
        body: { type, days: 14 },
      })
      showToast(`Listing ${type.toLowerCase()} applied.`, "success")
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
            Listings Control Center
          </p>
          <h1 className="mt-2 text-4xl font-black">Listings</h1>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="ops-input"
            placeholder="Search title, city, owner..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <select className="ops-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="ops-input" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="created_desc">Newest</option>
            <option value="price_desc">Price high</option>
            <option value="price_asc">Price low</option>
            <option value="reports_desc">Most reports</option>
          </select>
        </div>
      </div>
      <section className="ops-card mb-5 grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ops-muted)]">Saved views</p><div className="mt-2 flex flex-wrap gap-2">{savedViews.length ? savedViews.map((view) => <button key={view.id} className="ops-pill" onClick={() => applySavedView(view.id)}>{view.name}</button>) : <span className="text-sm text-[var(--ops-muted)]">Save recurring search and moderation filters here.</span>}</div></div>
        <div className="flex gap-2"><input className="ops-input min-w-0" placeholder="View name" value={viewName} onChange={(event) => setViewName(event.target.value)} /><button className="ops-button" disabled={!viewName.trim()} onClick={saveCurrentView}>Save view</button></div>
      </section>

      {selectedIds.length ? <section className="ops-card sticky top-3 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 border-[var(--ops-accent)] p-4"><strong>{selectedIds.length} listings selected</strong><div className="flex flex-wrap gap-2"><select className="ops-input w-auto" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="ops-button ops-button-primary" disabled={bulkPending} onClick={() => void bulkAction()}>{bulkPending ? "Updating..." : "Apply to selected"}</button><button className="ops-button" onClick={() => setSelectedIds([])}>Clear</button></div></section> : null}

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading listings..." /> : null}

      {data && data.data.length === 0 ? <EmptyBlock title="No listings found" /> : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card ops-table-wrap overflow-hidden">
          <table className="ops-table" data-responsive="cards">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible listings" checked={Boolean(data.data.length) && selectedIds.length === data.data.length} onChange={() => setSelectedIds(selectedIds.length === data.data.length ? [] : data.data.map((item) => item.id))} /></th>
                <th>Listing</th>
                <th>Owner</th>
                <th>Metrics</th>
                <th>Intelligence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((listing) => (
                <tr key={listing.id}>
                  <td data-label="Select"><input type="checkbox" checked={selectedIds.includes(listing.id)} onChange={() => setSelectedIds((current) => current.includes(listing.id) ? current.filter((id) => id !== listing.id) : [...current, listing.id])} aria-label={`Select ${listing.title}`} /></td>
                  <td data-label="Listing">
                    <strong>{listing.title}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {listing.city} · ${Number(listing.price).toLocaleString()} · {listing.status}
                    </p>
                  </td>
                  <td data-label="Owner">
                    <strong>{listing.owner.email}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {listing.owner.plan} · {listing.owner.isVerified ? "verified" : "not verified"}
                    </p>
                  </td>
                  <td data-label="Metrics" className="text-sm text-[var(--ops-muted)]">
                    {listing.metrics.views} views<br />
                    {listing.metrics.favorites} favorites<br />
                    {listing.metrics.leads} leads<br />
                    {listing.metrics.reports} reports
                  </td>
                  <td data-label="Intelligence">
                    <span className="ops-pill">Quality {listing.intelligence.qualityScore}</span>
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">
                      Risk: {listing.intelligence.duplicateRisk}
                    </p>
                    {listing.intelligence.fraudFlags.length > 0 ? (
                      <p className="mt-1 text-sm text-[var(--ops-warning)]">
                        {listing.intelligence.fraudFlags.join(", ")}
                      </p>
                    ) : null}
                  </td>
                  <td data-label="Actions">
                    <div className="flex flex-wrap gap-2">
                      <button className="ops-button" onClick={() => action(listing.id, "PUBLISHED")}>Publish</button>
                      <button className="ops-button" onClick={() => action(listing.id, "ARCHIVED")}>Archive</button>
                      <button className="ops-button" onClick={() => feature(listing.id, "FEATURED")}>Feature</button>
                      <button className="ops-button" onClick={() => feature(listing.id, "BOOSTED")}>Boost</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
