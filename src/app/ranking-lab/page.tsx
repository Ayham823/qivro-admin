"use client"

import { useEffect, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  getRankingLab,
  updateRecommendationStrategy,
  type OpsRankingLab,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function RankingLabPage() {
  const [data, setData] = useState<OpsRankingLab | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadData = async () => {
    const token = getToken()
    if (!token) return
    setData(await getRankingLab(token))
  }

  useEffect(() => {
    loadData().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load ranking lab")
    )
  }, [])

  const activateStrategy = async (
    strategy: "DEFAULT" | "POPULARITY" | "BEHAVIOR" | "AI"
  ) => {
    const token = getToken()
    if (!token) return

    try {
      setBusy(strategy)
      await updateRecommendationStrategy(token, strategy)
      await loadData()
      showToast(`Active strategy changed to ${strategy}.`, "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update strategy", "error")
    } finally {
      setBusy("")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Recommendation & Ranking Lab
        </p>
        <h1 className="mt-2 text-4xl font-black">Ranking Lab</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Compare ranking strategies and choose what powers the recommendation rails
          that users see in the product.
        </p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading ranking lab..." /> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Engine" value={data.engine.version} />
            <KpiCard label="Active Strategy" value={data.activeStrategy} />
            <KpiCard label="Strategies" value={data.strategies.length} />
          </section>

          <section className="ops-card p-5">
            <h2 className="text-xl font-black">Hybrid Weights</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-white/5 p-4 text-sm">
                <p className="font-black">Search</p>
                <p className="mt-2 text-[var(--ops-muted)]">
                  Rules {data.engine.searchWeights.rules} · AI {data.engine.searchWeights.ai}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 text-sm">
                <p className="font-black">Recommendations</p>
                <p className="mt-2 text-[var(--ops-muted)]">
                  Rules {data.engine.recommendationWeights.rules} · AI {data.engine.recommendationWeights.ai}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--ops-muted)]">
              Sampled viewers: {data.sampledViewers}
            </p>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Strategy Comparison</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>CTR</th>
                  <th>Save Rate</th>
                  <th>Lead Rate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.strategies.map((item) => (
                  <tr key={item.strategy}>
                    <td>
                      <strong>{item.strategy}</strong>
                      {item.isActive ? (
                        <p className="mt-1 text-sm text-[var(--ops-accent)]">Active</p>
                      ) : null}
                    </td>
                    <td>{item.metrics.ctr}%</td>
                    <td>{item.metrics.saveRate}%</td>
                    <td>{item.metrics.leadRate}%</td>
                    <td>
                      <button
                        className="ops-button"
                        disabled={item.isActive || busy === item.strategy}
                        onClick={() => activateStrategy(item.strategy)}
                      >
                        {item.isActive ? "Active" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            {data.strategies.map((item) => (
              <div key={item.strategy} className="ops-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">{item.strategy}</h2>
                  {item.isActive ? <span className="ops-pill">Active</span> : null}
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <p className="flex justify-between">
                    <span className="text-[var(--ops-muted)]">CTR</span>
                    <strong>{item.metrics.ctr}%</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-[var(--ops-muted)]">Save Rate</span>
                    <strong>{item.metrics.saveRate}%</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-[var(--ops-muted)]">Lead Rate</span>
                    <strong>{item.metrics.leadRate}%</strong>
                  </p>
                </div>
                <div className="mt-5 grid gap-2">
                  {item.topListings.map((listing) => (
                    <div key={listing.id} className="rounded-lg bg-white/5 p-3 text-sm">
                      <strong>{listing.title}</strong>
                      <p className="mt-1 text-[var(--ops-muted)]">
                        {listing.city} · {listing.appearances} appearances · avg {listing.avgScore}
                      </p>
                      <p className="mt-1 text-[var(--ops-muted)]">
                        {listing.views} views · {listing.favorites} saves · {listing.leads} leads
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
