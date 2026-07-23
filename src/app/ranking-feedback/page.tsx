"use client"

import { useEffect, useMemo, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  getRankingFeedback,
  updateRankingFeedback,
  type OpsRankingFeedback,
  type OpsRankingFeedbackItem,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

type Quality = "GOOD" | "BAD"
type Relevance = "RELEVANT" | "NOT_RELEVANT"

export default function RankingFeedbackPage() {
  const [data, setData] = useState<OpsRankingFeedback | null>(null)
  const [error, setError] = useState("")
  const [objective, setObjective] = useState("")
  const [reviewState, setReviewState] = useState("pending")
  const [busy, setBusy] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { showToast, ToastHost } = useToast()

  const params = useMemo(() => {
    const nextParams = new URLSearchParams()

    if (objective) nextParams.set("objective", objective)
    if (reviewState) nextParams.set("reviewState", reviewState)

    return nextParams
  }, [objective, reviewState])

  const loadData = async () => {
    const token = getToken()
    if (!token) return

    setData(await getRankingFeedback(token, params))
  }

  useEffect(() => {
    loadData().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load ranking feedback")
    )
  }, [params])

  const updateFeedback = async (
    item: OpsRankingFeedbackItem,
    input: { quality?: Quality; relevance?: Relevance }
  ) => {
    const token = getToken()
    if (!token) return

    try {
      setBusy(item.id)
      await updateRankingFeedback(token, item.id, {
        ...input,
        reviewerNote: notes[item.id] ?? item.feedback?.reviewerNote ?? "",
      })
      await loadData()
      showToast("Ranking feedback saved.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Feedback update failed", "error")
    } finally {
      setBusy("")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Ranking Review
        </p>
        <h1 className="mt-2 text-4xl font-black">Ranking Feedback</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Review search and recommendation decisions, inspect score components,
          and label ranking quality for future tuning.
        </p>
      </div>

      <section className="ops-card mb-6 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="ops-input"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          >
            <option value="">All objectives</option>
            <option value="SEARCH">Search</option>
            <option value="RECOMMENDATION">Recommendation</option>
          </select>

          <select
            className="ops-input"
            value={reviewState}
            onChange={(event) => setReviewState(event.target.value)}
          >
            <option value="">All review states</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
          </select>

          <button className="ops-button" onClick={() => loadData()}>
            Refresh
          </button>
        </div>
      </section>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading ranking feedback..." /> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Pending" value={data.summary.pending} />
            <KpiCard label="Reviewed" value={data.summary.reviewed} />
            <KpiCard label="Good" value={data.summary.good} />
            <KpiCard label="Bad" value={data.summary.bad} />
            <KpiCard label="Relevant" value={data.summary.relevant} />
            <KpiCard label="Not Relevant" value={data.summary.notRelevant} />
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Decision Items</h2>
            </div>

            {data.data.length > 0 ? (
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Decision</th>
                    <th>Scores</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.listingTitle}</strong>
                        <p className="mt-1 text-sm text-[var(--ops-muted)]">
                          {item.city} · ${item.price.toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">
                          Rank #{item.rank}
                        </p>
                      </td>
                      <td>
                        <strong>{item.decision.objective}</strong>
                        <p className="mt-1 text-sm text-[var(--ops-muted)]">
                          {item.decision.strategy ?? item.decision.engineVersion}
                        </p>
                        {item.decision.queryText ? (
                          <p className="mt-1 text-sm text-[var(--ops-muted)]">
                            {item.decision.queryText}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm text-[var(--ops-accent)]">
                          {item.reason ?? "No explanation"}
                        </p>
                      </td>
                      <td>
                        <div className="grid gap-1 text-sm">
                          <span>Total: {item.score}</span>
                          <span className="text-[var(--ops-muted)]">
                            Rules: {item.baseScore}
                          </span>
                          <span className="text-[var(--ops-muted)]">
                            AI: {item.aiScore}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="grid gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="ops-button"
                              disabled={busy === item.id}
                              onClick={() => updateFeedback(item, { quality: "GOOD" })}
                            >
                              Good
                            </button>
                            <button
                              className="ops-button"
                              disabled={busy === item.id}
                              onClick={() => updateFeedback(item, { quality: "BAD" })}
                            >
                              Bad
                            </button>
                            <button
                              className="ops-button"
                              disabled={busy === item.id}
                              onClick={() => updateFeedback(item, { relevance: "RELEVANT" })}
                            >
                              Relevant
                            </button>
                            <button
                              className="ops-button"
                              disabled={busy === item.id}
                              onClick={() =>
                                updateFeedback(item, { relevance: "NOT_RELEVANT" })
                              }
                            >
                              Not relevant
                            </button>
                          </div>

                          <textarea
                            className="ops-input min-h-20"
                            placeholder="Reviewer note"
                            value={notes[item.id] ?? item.feedback?.reviewerNote ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                          />

                          {item.feedback ? (
                            <p className="text-xs text-[var(--ops-muted)]">
                              {item.feedback.quality ?? "No quality"} ·{" "}
                              {item.feedback.relevance ?? "No relevance"}
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyBlock title="No ranking decisions found" />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
