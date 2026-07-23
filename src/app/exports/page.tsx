"use client"

import { useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { ErrorBlock } from "@/components/StateBlock"
import { apiRequest, type OpsExportDataset } from "@/lib/api"
import { getToken } from "@/lib/auth"

const datasets = [
  {
    id: "search-queries",
    title: "Search Queries",
    description: "Search events and filters for search parser and discovery tuning.",
  },
  {
    id: "ai-requests",
    title: "AI Requests",
    description: "AI inputs, outputs, latency, success/failure, and endpoint usage.",
  },
  {
    id: "fraud-risk-cases",
    title: "Fraud / Risk Cases",
    description: "Reported listings and moderation cases for trust model development.",
  },
  {
    id: "listing-quality-results",
    title: "Listing Quality",
    description: "Quality proxy scores, listing performance, and risk flags.",
  },
  {
    id: "neighborhood-summary-usage",
    title: "Neighborhood AI Usage",
    description: "Neighborhood summary requests and outputs for local insight tuning.",
  },
  {
    id: "leads-conversion-patterns",
    title: "Leads + Conversions",
    description: "Lead outcomes joined with listing and owner performance signals.",
  },
]

export default function ExportsPage() {
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<OpsExportDataset | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [city, setCity] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [outcome, setOutcome] = useState("")

  const loadDataset = async (dataset: string, format: "json" | "csv") => {
    const token = getToken()
    if (!token) return

    try {
      setError("")
      const params = new URLSearchParams({ format })
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      if (city) params.set("city", city)
      if (endpoint) params.set("endpoint", endpoint)
      if (outcome) params.set("outcome", outcome)

      const result = await apiRequest<OpsExportDataset>(
        `/admin/exports/${dataset}?${params.toString()}`,
        { token }
      )
      setPreview(result)

      if (format === "csv" && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${dataset}.csv`
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    }
  }

  return (
    <GuardedOpsShell>
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Data Export / AI Dataset Tools
        </p>
        <h1 className="mt-2 text-4xl font-black">Exports</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Export operational datasets for AI tuning, search analysis, fraud review,
          and offline inspection.
        </p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}

      <section className="ops-card mb-5 grid gap-3 p-4 md:grid-cols-5">
        <input
          className="ops-input"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          className="ops-input"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <input
          className="ops-input"
          placeholder="City filter"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <input
          className="ops-input"
          placeholder="AI endpoint"
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
        />
        <select className="ops-input" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="">Any outcome</option>
          <option value="success">Success only</option>
          <option value="failure">Failure only</option>
        </select>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {datasets.map((dataset) => (
          <div key={dataset.id} className="ops-card p-5">
            <h2 className="text-xl font-black">{dataset.title}</h2>
            <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--ops-muted)]">
              {dataset.description}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="ops-button" onClick={() => loadDataset(dataset.id, "json")}>Preview JSON</button>
              <button className="ops-button" onClick={() => loadDataset(dataset.id, "csv")}>Download CSV</button>
            </div>
          </div>
        ))}
      </section>

      {preview ? (
        <section className="ops-card mt-6 p-5">
          <h2 className="text-xl font-black">
            Preview: {preview.dataset} ({preview.rows.length} rows)
          </h2>
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-lg bg-black/30 p-4 text-xs text-[var(--ops-muted)]">
            {JSON.stringify(preview.rows.slice(0, 20), null, 2)}
          </pre>
        </section>
      ) : null}
    </GuardedOpsShell>
  )
}
