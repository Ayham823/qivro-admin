"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import { apiRequest, type OpsListing, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function SuspiciousListingsPage() {
  const router = useRouter()
  const [data, setData] = useState<Paginated<OpsListing> | null>(null)
  const [q, setQ] = useState("")
  const [city, setCity] = useState("")
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
    if (q) params.set("q", q)
    if (city) params.set("city", city)

    apiRequest<Paginated<OpsListing>>(
      `/admin/moderation/suspicious-listings?${params.toString()}`,
      { token }
    )
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load suspicious listings")
      )
  }, [city, page, q, refreshKey, router])

  const updateStatus = async (listingId: string, nextStatus: "PUBLISHED" | "ARCHIVED") => {
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

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Fraud / Trust Center
          </p>
          <h1 className="mt-2 text-4xl font-black">Suspicious Listings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ops-muted)]">
            Listings surfaced by report count, missing images, invalid price, or other risk signals.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="ops-input"
            placeholder="Search listing or owner..."
            value={q}
            onChange={(event) => {
              setPage(1)
              setQ(event.target.value)
            }}
          />
          <input
            className="ops-input"
            placeholder="Filter city..."
            value={city}
            onChange={(event) => {
              setPage(1)
              setCity(event.target.value)
            }}
          />
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading suspicious listings..." /> : null}
      {data && data.data.length === 0 ? <EmptyBlock title="No suspicious listings found" /> : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card overflow-hidden">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Owner</th>
                <th>Signals</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <strong>{listing.title}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {listing.city} · ${Number(listing.price).toLocaleString()} · {listing.status}
                    </p>
                  </td>
                  <td>
                    <strong>{listing.owner.email}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {listing.owner.plan} · {listing.owner.isVerified ? "verified" : "not verified"}
                    </p>
                  </td>
                  <td>
                    <span className="ops-pill">Quality {listing.intelligence.qualityScore}</span>
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">
                      {listing.metrics.reports} reports · {listing.metrics.views} views · {listing.metrics.leads} leads
                    </p>
                    <p className="mt-1 text-sm text-[var(--ops-warning)]">
                      {listing.intelligence.fraudFlags.length > 0
                        ? listing.intelligence.fraudFlags.join(", ")
                        : "risk signal detected"}
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="ops-button" onClick={() => updateStatus(listing.id, "PUBLISHED")}>
                        Publish
                      </button>
                      <button className="ops-button" onClick={() => updateStatus(listing.id, "ARCHIVED")}>
                        Archive
                      </button>
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
