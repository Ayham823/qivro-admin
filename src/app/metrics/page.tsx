"use client"

import { useEffect, useMemo, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import {
  getMetrics,
  type OpsMetricsDashboard,
  type OpsSurfaceMetrics,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

type RangeKey = "7d" | "30d" | "90d" | "all"

const ranges: Array<{ key: RangeKey; label: string; days?: number }> = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time" },
]

function paramsForRange(range: RangeKey) {
  const current = ranges.find((item) => item.key === range)
  const params = new URLSearchParams()

  if (current?.days) {
    const date = new Date()
    date.setDate(date.getDate() - current.days)
    params.set("dateFrom", date.toISOString())
  }

  return params
}

function SurfaceCard({
  title,
  data,
}: {
  title: string
  data: OpsSurfaceMetrics
}) {
  return (
    <div className="ops-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-accent)]">
            {title}
          </p>
          <h2 className="mt-2 text-2xl font-black">{data.usageRate}% usage</h2>
        </div>
        <span className="ops-pill">{data.usersOrSessions} users/sessions</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <KpiCard label="Views" value={data.views} />
        <KpiCard label="Favorites" value={data.favorites} />
        <KpiCard label="Leads" value={data.leads} />
        <KpiCard label="Save Rate" value={`${data.saveRate}%`} />
        <KpiCard label="Lead Rate" value={`${data.leadRate}%`} />
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const [data, setData] = useState<OpsMetricsDashboard | null>(null)
  const [error, setError] = useState("")
  const [range, setRange] = useState<RangeKey>("30d")
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => paramsForRange(range), [range])

  useEffect(() => {
    const loadData = async () => {
      const token = getToken()
      if (!token) return

      setLoading(true)
      setError("")
      setData(await getMetrics(token, params))
      setLoading(false)
    }

    loadData().catch((err) => {
      setLoading(false)
      setError(err instanceof Error ? err.message : "Failed to load metrics")
    })
  }, [params])

  return (
    <GuardedOpsShell>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Product Analytics
          </p>
          <h1 className="mt-2 text-4xl font-black">Product Metrics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
            CTR, save rate, lead rate, funnel health, Explore usage, search usage,
            and AI impact from the internal event pipeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item.key}
              className={`rounded-lg px-3 py-2 text-sm font-extrabold ${
                range === item.key
                  ? "bg-[var(--ops-accent)] text-[#06110f]"
                  : "bg-white/5 text-[var(--ops-muted)] hover:text-white"
              }`}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {loading ? <LoadingBlock label="Loading metrics..." /> : null}

      {data && !loading ? (
        <div className="space-y-8">
          {data.meta.note ? (
            <div className="ops-card p-4 text-sm leading-6 text-[var(--ops-muted)]">
              {data.meta.note}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Active Users/Sessions"
              value={data.overview.activeUsersOrSessions}
            />
            <KpiCard label="CTR" value={`${data.overview.ctr}%`} />
            <KpiCard label="Save Rate" value={`${data.overview.saveRate}%`} />
            <KpiCard label="Lead Rate" value={`${data.overview.leadRate}%`} />
            <KpiCard label="Search Usage" value={`${data.surfaces.searchUsageRate}%`} />
            <KpiCard label="Searches" value={data.overview.searches} />
            <KpiCard label="Views" value={data.overview.views} />
            <KpiCard label="Inquiries" value={data.overview.leads} />
            <KpiCard label="Chats Started" value={data.overview.chats} />
            <KpiCard label="Messages Sent" value={data.overview.messages} />
          </section>

          <section className="ops-card p-5">
            <h2 className="text-2xl font-black">Contact vs Messaging</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
              Inquiries are official leads. Chats are ongoing conversations and
              message activity.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <KpiCard label="INQUIRY_CREATED" value={data.overview.leads} />
              <KpiCard label="CHAT_STARTED" value={data.overview.chats} />
              <KpiCard label="MESSAGE_SENT" value={data.overview.messages} />
            </div>
          </section>

          <section className="ops-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Conversion Funnel</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
                  Visit to search to view to favorite to lead, counted by unique
                  user/session.
                </p>
              </div>
              <span className="ops-pill">
                Search to lead: {data.overview.searchToLeadRate}%
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              {data.funnel.map((step) => (
                <div key={step.step}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <strong>{step.step}</strong>
                    <span className="text-[var(--ops-muted)]">
                      {step.count} · {step.rateFromVisit}% from visit ·{" "}
                      {step.rateFromPrevious}% from previous
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded bg-white/10">
                    <div
                      className="h-full rounded bg-[var(--ops-accent)]"
                      style={{ width: `${Math.min(100, step.rateFromVisit)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <SurfaceCard title="Explore" data={data.surfaces.explore} />
            <SurfaceCard title="Listings / Details" data={data.surfaces.listings} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-2xl font-black">AI vs Non-AI Search</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
                Measures whether accepted AI search suggestions lead to listing views
                better than normal searches.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <KpiCard label="AI CTR" value={`${data.ai.search.aiCtr}%`} />
                <KpiCard label="Non-AI CTR" value={`${data.ai.search.nonAiCtr}%`} />
                <KpiCard label="CTR Lift" value={`${data.ai.search.aiCtrLift}%`} />
                <KpiCard
                  label="AI Acceptance"
                  value={`${data.ai.search.acceptanceRate}%`}
                />
                <KpiCard label="AI Accepted" value={data.ai.search.accepted} />
                <KpiCard label="AI Rejected" value={data.ai.search.rejected} />
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-2xl font-black">AI Ranking Experiment</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
                Variant comparison for {data.ai.ranking.experimentKey}; empty means
                no exposure events have been tracked yet.
              </p>

              <div className="mt-5 grid gap-3">
                {data.ai.ranking.variants.length ? (
                  data.ai.ranking.variants.map((variant) => (
                    <div
                      key={variant.variant}
                      className="rounded-lg bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong>Variant {variant.variant}</strong>
                        <span className="text-sm text-[var(--ops-muted)]">
                          {variant.exposures} exposures
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <KpiCard label="CTR" value={`${variant.ctr}%`} />
                        <KpiCard label="Conversion" value={`${variant.conversion}%`} />
                        <KpiCard label="Leads" value={variant.leads} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ops-muted)]">
                    No ranking experiment exposure data yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-2xl font-black">Event Sources</h2>
              <div className="mt-4 grid gap-2">
                {data.surfaces.sources.length ? (
                  data.surfaces.sources.map((source) => (
                    <div
                      key={source.value}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-[var(--ops-muted)]">{source.value}</span>
                      <strong>{source.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ops-muted)]">
                    No source data yet.
                  </p>
                )}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-2xl font-black">Daily Trend</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.16em] text-[var(--ops-muted)]">
                    <tr>
                      <th className="py-2">Date</th>
                      <th className="py-2">Search</th>
                      <th className="py-2">Views</th>
                      <th className="py-2">Saves</th>
                      <th className="py-2">Inquiries</th>
                      <th className="py-2">Chats</th>
                      <th className="py-2">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trends.slice(-10).map((item) => (
                      <tr key={item.date} className="border-t border-white/10">
                        <td className="py-3">{item.date}</td>
                        <td className="py-3">{item.searches}</td>
                        <td className="py-3">{item.views}</td>
                        <td className="py-3">{item.favorites}</td>
                        <td className="py-3">{item.leads}</td>
                        <td className="py-3">{item.chats}</td>
                        <td className="py-3">{item.messages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.trends.length ? (
                  <p className="py-4 text-sm text-[var(--ops-muted)]">
                    No trend data yet.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
