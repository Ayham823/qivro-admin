"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import { apiRequest, type OpsUser, type Paginated } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function UsersPage() {
  const router = useRouter()
  const [data, setData] = useState<Paginated<OpsUser> | null>(null)
  const [q, setQ] = useState("")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const { showToast, ToastHost } = useToast()

  useEffect(() => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({ limit: "25", page: String(page) })
    if (q) params.set("q", q)

    apiRequest<Paginated<OpsUser>>(`/admin/users?${params.toString()}`, { token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
  }, [page, q, refreshKey, router])

  const updateUser = async (userId: string, body: Record<string, unknown>) => {
    if (!window.confirm("Confirm this sensitive user account change?")) {
      return
    }

    const token = getToken()
    if (!token) return

    try {
      await apiRequest(`/admin/users/${userId}`, {
        method: "PATCH",
        token,
        body,
      })
      showToast("User updated.", "success")
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
            Users & Verification
          </p>
          <h1 className="mt-2 text-4xl font-black">Users</h1>
        </div>
        <input
          className="ops-input max-w-md"
          placeholder="Search name, email, phone..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading users..." /> : null}

      {data && data.data.length === 0 ? <EmptyBlock title="No users found" /> : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card overflow-hidden">
          <table className="ops-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Access</th>
                <th>Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.email}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {user.name ?? "No name"} · {user.phone ?? "No phone"}
                    </p>
                  </td>
                  <td>
                    <span className="ops-pill">{user.role}</span>
                    <span className="ops-pill ml-2">{user.plan}</span>
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">
                      {user.isVerified ? "Verified" : "Not verified"}
                    </p>
                  </td>
                  <td className="text-sm text-[var(--ops-muted)]">
                    {user.metrics.listings} listings<br />
                    {user.metrics.favorites} favorites<br />
                    {user.metrics.payments} payments<br />
                    {user.metrics.notifications} notifications
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="ops-button" onClick={() => updateUser(user.id, { isVerified: true })}>Verify</button>
                      <button className="ops-button" onClick={() => updateUser(user.id, { plan: "PREMIUM" })}>Premium</button>
                      <button className="ops-button" onClick={() => updateUser(user.id, { role: "ADMIN" })}>Make Admin</button>
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
