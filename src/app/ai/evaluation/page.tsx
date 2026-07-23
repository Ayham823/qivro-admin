"use client"

import { useEffect, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  getAiEvaluation,
  getAiEvaluationDataset,
  type OpsAiEvaluation,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function AiEvaluationPage() {
  const [data, setData] = useState<OpsAiEvaluation | null>(null)
  const [endpoint, setEndpoint] = useState("")
  const [error, setError] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadEvaluation = async () => {
    const token = getToken()
    if (!token) return

    const params = new URLSearchParams()
    if (endpoint) params.set("endpoint", endpoint)

    setData(await getAiEvaluation(token, params))
  }

  useEffect(() => {
    loadEvaluation().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load AI evaluation")
    )
  }, [endpoint])

  const downloadDataset = async (format: "json" | "csv") => {
    const token = getToken()
    if (!token) return

    try {
      const params = new URLSearchParams({ format })
      if (endpoint) params.set("endpoint", endpoint)
      const result = await getAiEvaluationDataset(token, params)

      if (format === "csv" && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "ai-evaluation.csv"
        link.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([JSON.stringify(result.rows, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "ai-evaluation.json"
        link.click()
        URL.revokeObjectURL(url)
      }

      showToast("Evaluation dataset downloaded.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed", "error")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
            Evaluation Datasets + Offline Evaluation
          </p>
          <h1 className="mt-2 text-4xl font-black">AI Evaluation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
            Measures how reviewed AI outputs are performing across search parse,
            listing quality, content generation, and neighborhood summary.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="ops-input"
            placeholder="Filter endpoint"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
          <button className="ops-button" onClick={() => downloadDataset("json")}>
            Download JSON
          </button>
          <button className="ops-button" onClick={() => downloadDataset("csv")}>
            Download CSV
          </button>
        </div>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading AI evaluation..." /> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Reviewed Samples" value={data.totals.reviewed} />
            <KpiCard label="Failure Cases" value={data.totals.failureCases} />
            <KpiCard label="Tracked Endpoints" value={data.summary.length} />
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Endpoint Scores</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Reviewed</th>
                  <th>Accuracy</th>
                  <th>Success Rate</th>
                  <th>Rejection Rate</th>
                  <th>Usefulness</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((item) => (
                  <tr key={item.endpoint}>
                    <td><strong>{item.endpoint}</strong></td>
                    <td>{item.reviewed}</td>
                    <td>{item.accuracy}%</td>
                    <td>{item.successRate}%</td>
                    <td>{item.rejectionRate}%</td>
                    <td>{item.usefulnessScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Failure Cases</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Expected / Prediction</th>
                  <th>Why it failed</th>
                </tr>
              </thead>
              <tbody>
                {data.failureCases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.endpoint}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {item.provider ?? "unknown"} · {item.model ?? "unknown"} · {item.latencyMs}ms
                      </p>
                    </td>
                    <td>
                      <pre className="max-h-56 max-w-2xl overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                        {JSON.stringify(
                          {
                            input: item.input,
                            expected: item.expected,
                            prediction: item.prediction,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </td>
                    <td className="text-sm text-[var(--ops-muted)]">
                      <p>correct: {String(item.correct)}</p>
                      <p>approved: {String(item.approved)}</p>
                      <p>useful: {String(item.useful)}</p>
                      {item.reviewerNote ? <p className="mt-2">{item.reviewerNote}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Trends</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Endpoint</th>
                  <th>Reviewed</th>
                  <th>Correct</th>
                  <th>Rejected</th>
                  <th>Useful</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.map((item) => (
                  <tr key={`${item.date}-${item.endpoint}`}>
                    <td>{item.date}</td>
                    <td><strong>{item.endpoint}</strong></td>
                    <td>{item.reviewed}</td>
                    <td>{item.correct}</td>
                    <td>{item.rejected}</td>
                    <td>{item.useful}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
