"use client"

import { useEffect, useState } from "react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import KpiCard from "@/components/KpiCard"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  createSearchOverride,
  createSearchSynonym,
  deleteSearchOverride,
  deleteSearchSynonym,
  getSearchQuality,
  type OpsSearchQuality,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function SearchQualityPage() {
  const [data, setData] = useState<OpsSearchQuality | null>(null)
  const [error, setError] = useState("")
  const [term, setTerm] = useState("")
  const [synonym, setSynonym] = useState("")
  const [overrideQuery, setOverrideQuery] = useState("")
  const [rewrittenQuery, setRewrittenQuery] = useState("")
  const [overrideFilters, setOverrideFilters] = useState("{}")
  const [overrideNote, setOverrideNote] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadData = async () => {
    const token = getToken()
    if (!token) return
    setData(await getSearchQuality(token))
  }

  useEffect(() => {
    loadData().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load search quality")
    )
  }, [])

  const addSynonym = async () => {
    const token = getToken()
    if (!token) return

    try {
      await createSearchSynonym(token, { term, synonym })
      setTerm("")
      setSynonym("")
      await loadData()
      showToast("Synonym added.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add synonym", "error")
    }
  }

  const addOverride = async () => {
    const token = getToken()
    if (!token) return

    try {
      await createSearchOverride(token, {
        query: overrideQuery,
        rewrittenQuery,
        filtersJson: JSON.parse(overrideFilters) as Record<string, unknown>,
        note: overrideNote,
        active: true,
      })
      setOverrideQuery("")
      setRewrittenQuery("")
      setOverrideFilters("{}")
      setOverrideNote("")
      await loadData()
      showToast("Manual override saved.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Override must use valid JSON", "error")
    }
  }

  const removeSynonym = async (id: string) => {
    const token = getToken()
    if (!token) return

    try {
      await deleteSearchSynonym(token, id)
      await loadData()
      showToast("Synonym deleted.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error")
    }
  }

  const removeOverride = async (id: string) => {
    const token = getToken()
    if (!token) return

    try {
      await deleteSearchOverride(token, id)
      await loadData()
      showToast("Override deleted.", "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Search Quality Lab
        </p>
        <h1 className="mt-2 text-4xl font-black">Search Quality</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Watch no-results queries, low CTR queries, failed AI parses, and apply
          manual improvements through synonyms and query overrides.
        </p>
      </div>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading search quality lab..." /> : null}

      {data ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Searches" value={data.overview.totalSearches} />
            <KpiCard label="No Results" value={data.overview.noResults} />
            <KpiCard label="Low CTR" value={data.overview.lowCtr} />
            <KpiCard label="Failed AI Parses" value={data.overview.failedAiParses} />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Top Queries</h2>
              <div className="mt-4 grid gap-2">
                {data.topQueries.map((item) => (
                  <div key={item.query} className="flex justify-between text-sm">
                    <span className="text-[var(--ops-muted)]">{item.query}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Rewrite Suggestions</h2>
              <div className="mt-4 grid gap-3">
                {data.rewriteSuggestions.map((item) => (
                  <div key={`${item.query}-${item.suggestion}`} className="rounded-lg bg-white/5 p-3 text-sm">
                    <strong>{item.query}</strong>
                    <p className="mt-1 text-[var(--ops-muted)]">{item.suggestion}</p>
                    <p className="mt-1 text-xs text-[var(--ops-warning)]">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="ops-card overflow-hidden">
              <div className="p-5">
                <h2 className="text-xl font-black">No-Results Queries</h2>
              </div>
              {data.noResultsQueries.length > 0 ? (
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.noResultsQueries.map((item) => (
                      <tr key={item.query}>
                        <td><strong>{item.query}</strong></td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-5">
                  <EmptyBlock title="No no-results queries" />
                </div>
              )}
            </div>

            <div className="ops-card overflow-hidden">
              <div className="p-5">
                <h2 className="text-xl font-black">Low CTR Queries</h2>
              </div>
              {data.lowCtrQueries.length > 0 ? (
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Searches</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowCtrQueries.map((item) => (
                      <tr key={item.query}>
                        <td><strong>{item.query}</strong></td>
                        <td>{item.searches}</td>
                        <td>{item.clicks}</td>
                        <td>{item.ctr}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-5">
                  <EmptyBlock title="No low CTR queries" />
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Synonym Management</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className="ops-input" placeholder="term" value={term} onChange={(event) => setTerm(event.target.value)} />
                <input className="ops-input" placeholder="synonym" value={synonym} onChange={(event) => setSynonym(event.target.value)} />
                <button className="ops-button" onClick={addSynonym}>Add synonym</button>
              </div>
              <div className="mt-4 grid gap-2">
                {data.synonyms.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                    <span className="text-[var(--ops-muted)]">
                      {item.term} {"->"} {item.synonym}
                    </span>
                    <button className="ops-button" onClick={() => removeSynonym(item.id)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-card p-5">
              <h2 className="text-xl font-black">Manual Override</h2>
              <div className="mt-4 grid gap-3">
                <input className="ops-input" placeholder="query" value={overrideQuery} onChange={(event) => setOverrideQuery(event.target.value)} />
                <input className="ops-input" placeholder="rewritten query" value={rewrittenQuery} onChange={(event) => setRewrittenQuery(event.target.value)} />
                <textarea className="ops-input min-h-28" placeholder='filters JSON e.g. {"city":"Haifa","maxPrice":3000}' value={overrideFilters} onChange={(event) => setOverrideFilters(event.target.value)} />
                <input className="ops-input" placeholder="note" value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} />
                <button className="ops-button" onClick={addOverride}>Save override</button>
              </div>
              <div className="mt-4 grid gap-2">
                {data.overrides.map((item) => (
                  <div key={item.id} className="rounded-lg bg-white/5 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong>{item.query}</strong>
                        <p className="mt-1 text-[var(--ops-muted)]">
                          rewrite: {item.rewrittenQuery ?? "none"}
                        </p>
                        <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                          {JSON.stringify(item.filtersJson, null, 2)}
                        </pre>
                      </div>
                      <button className="ops-button" onClick={() => removeOverride(item.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ops-card overflow-hidden">
            <div className="p-5">
              <h2 className="text-xl font-black">Failed AI Parses</h2>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {data.failedAiParses.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.endpoint}</strong>
                      <p className="mt-1 text-sm text-[var(--ops-muted)]">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="text-sm text-[var(--ops-muted)]">
                      {item.success ? "fallback" : "failed"}
                      {item.errorMessage ? <p className="mt-1 text-[var(--ops-danger)]">{item.errorMessage}</p> : null}
                    </td>
                    <td>
                      <pre className="max-h-44 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                        {JSON.stringify({ input: item.inputJson, output: item.outputJson }, null, 2)}
                      </pre>
                    </td>
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
