"use client"

import { useEffect, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { getExperiments, type OpsExperimentsDashboard } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function ExperimentsPage() {
  const [data, setData] = useState<OpsExperimentsDashboard | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadData = async () => {
      const token = getToken()
      if (!token) return

      setData(await getExperiments(token))
    }

    loadData().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load experiments")
    )
  }, [])

  return (
    <GuardedOpsShell>
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Controlled Experiments
        </p>
        <h1 className="mt-2 text-4xl font-black">Experiment Lab</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Compare variant A versus variant B, inspect CTR, leads, conversion, and
          retention, then decide changes with less risk.
        </p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading experiments..." /> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Active Experiments" value={data.overview.activeExperiments} />
            <KpiCard label="Total Exposures" value={data.overview.exposures} />
            <KpiCard label="Experiments" value={data.experiments.length} />
          </section>

          <section className="grid gap-5">
            {data.experiments.map((experiment) => (
              <div key={experiment.key} className="ops-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-accent)]">
                      {experiment.key}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{experiment.name}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
                      {experiment.description}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <span className="ops-pill">Status: {experiment.status}</span>
                    <span className="ops-pill">
                      Split: {experiment.split.control}/{experiment.split.treatment} (
                      {experiment.split.treatmentPercentage}% treatment)
                    </span>
                    <span className="ops-pill">
                      Primary metric: {experiment.primaryMetric}
                    </span>
                    <span className="ops-pill">Winner: {experiment.winner}</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {experiment.variants.map((variant) => (
                    <div key={variant.variant} className="rounded-xl bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-black">Variant {variant.variant}</h3>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ops-muted)]">
                          {variant.exposures} exposures
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <KpiCard label="CTR" value={`${variant.ctr}%`} />
                        <KpiCard label="Leads" value={variant.leads} />
                        <KpiCard label="Conversion" value={`${variant.conversion}%`} />
                        <KpiCard label="Retention" value={`${variant.retention}%`} />
                      </div>
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
