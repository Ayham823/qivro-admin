"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  getAiReviewQueue,
  updateAiFeedback,
  type OpsAiReviewItem,
  type Paginated,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function AiReviewQueuePage() {
  const router = useRouter()
  const [data, setData] = useState<Paginated<OpsAiReviewItem> | null>(null)
  const [page, setPage] = useState(1)
  const [endpoint, setEndpoint] = useState("")
  const [reviewState, setReviewState] = useState("pending")
  const [outcome, setOutcome] = useState("")
  const [correctness, setCorrectness] = useState("")
  const [usefulness, setUsefulness] = useState("")
  const [approval, setApproval] = useState("")
  const [fallback, setFallback] = useState("")
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const { showToast, ToastHost } = useToast()

  const loadQueue = async () => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }

    const params = new URLSearchParams({
      limit: "20",
      page: String(page),
    })

    if (endpoint) params.set("endpoint", endpoint)
    if (reviewState) params.set("reviewState", reviewState)
    if (outcome) params.set("outcome", outcome)
    if (correctness) params.set("correctness", correctness)
    if (usefulness) params.set("usefulness", usefulness)
    if (approval) params.set("approval", approval)
    if (fallback) params.set("fallback", fallback)

    setData(await getAiReviewQueue(token, params))
  }

  useEffect(() => {
    loadQueue().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load AI review queue")
    )
  }, [approval, correctness, endpoint, fallback, outcome, page, reviewState, router, usefulness])

  const submitFeedback = async (
    requestId: string,
    body: {
      correctness?: "CORRECT" | "INCORRECT"
      usefulness?: "USEFUL" | "NOT_USEFUL"
      approval?: "APPROVE" | "REJECT"
      reviewerNote?: string
      expectedOutputJson?: Record<string, unknown>
    },
    successMessage: string
  ) => {
    const token = getToken()
    if (!token) return

    try {
      setBusyId(requestId)
      await updateAiFeedback(token, requestId, body)
      await loadQueue()
      showToast(successMessage, "success")
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Feedback update failed", "error")
    } finally {
      setBusyId("")
    }
  }

  const addNote = async (requestId: string, currentNote?: string | null) => {
    const reviewerNote = window.prompt("Reviewer note", currentNote ?? "")
    if (reviewerNote === null) return

    await submitFeedback(requestId, { reviewerNote }, "Reviewer note saved.")
  }

  const setExpectedOutput = async (requestId: string, currentValue?: unknown) => {
    const raw = window.prompt(
      "Paste expected JSON output",
      currentValue ? JSON.stringify(currentValue, null, 2) : "{}"
    )
    if (raw === null) return

    try {
      const expectedOutputJson = JSON.parse(raw) as Record<string, unknown>
      await submitFeedback(
        requestId,
        { expectedOutputJson },
        "Expected output saved."
      )
    } catch {
      showToast("Expected output must be valid JSON.", "error")
    }
  }

  return (
    <GuardedOpsShell>
      <ToastHost />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          AI Feedback Loop
        </p>
        <h1 className="mt-2 text-4xl font-black">AI Review Queue</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">
          Human review queue for search parse, listing quality, neighborhood summary,
          and content generation outputs. Every decision is stored against the original
          request log for future evaluation datasets.
        </p>
      </div>

      <section className="ops-card mb-5 grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-7">
        <input
          className="ops-input"
          placeholder="Endpoint filter"
          value={endpoint}
          onChange={(event) => {
            setPage(1)
            setEndpoint(event.target.value)
          }}
        />
        <select className="ops-input" value={reviewState} onChange={(event) => {
          setPage(1)
          setReviewState(event.target.value)
        }}>
          <option value="">All review states</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <select className="ops-input" value={outcome} onChange={(event) => {
          setPage(1)
          setOutcome(event.target.value)
        }}>
          <option value="">Any outcome</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <select className="ops-input" value={correctness} onChange={(event) => {
          setPage(1)
          setCorrectness(event.target.value)
        }}>
          <option value="">Any correctness</option>
          <option value="CORRECT">Correct</option>
          <option value="INCORRECT">Incorrect</option>
        </select>
        <select className="ops-input" value={usefulness} onChange={(event) => {
          setPage(1)
          setUsefulness(event.target.value)
        }}>
          <option value="">Any usefulness</option>
          <option value="USEFUL">Useful</option>
          <option value="NOT_USEFUL">Not useful</option>
        </select>
        <select className="ops-input" value={approval} onChange={(event) => {
          setPage(1)
          setApproval(event.target.value)
        }}>
          <option value="">Any approval</option>
          <option value="APPROVE">Approved</option>
          <option value="REJECT">Rejected</option>
        </select>
        <select className="ops-input" value={fallback} onChange={(event) => {
          setPage(1)
          setFallback(event.target.value)
        }}>
          <option value="">Any fallback</option>
          <option value="true">Fallback used</option>
          <option value="false">Primary path</option>
        </select>
      </section>

      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading AI review queue..." /> : null}
      {data && data.data.length === 0 ? (
        <EmptyBlock
          title="No AI requests matched"
          description="Try broadening the filters or wait for fresh AI traffic."
        />
      ) : null}

      {data && data.data.length > 0 ? (
        <section className="ops-card overflow-hidden">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Signals</th>
                <th>Input / Output</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.endpoint}</strong>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {request.provider ?? "unknown provider"} · {request.model ?? "unknown model"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ops-muted)]">
                      {request.latencyMs}ms · {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td>
                    <span className="ops-pill">{request.success ? "success" : "failed"}</span>
                    <p className="mt-2 text-sm text-[var(--ops-muted)]">
                      fallback {request.fallbackUsed ? "yes" : "no"} · cache {request.cacheHit ? "hit" : "miss"}
                    </p>
                    {request.errorMessage ? (
                      <p className="mt-2 text-sm text-[var(--ops-danger)]">{request.errorMessage}</p>
                    ) : null}
                  </td>
                  <td>
                    <pre className="max-h-56 max-w-2xl overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ops-muted)]">
                      {JSON.stringify(
                        {
                          input: request.inputJson,
                          output: request.outputJson,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { correctness: "CORRECT" }, "Marked as correct.")}>
                        Correct
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { correctness: "INCORRECT" }, "Marked as incorrect.")}>
                        Incorrect
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { usefulness: "USEFUL" }, "Marked as useful.")}>
                        Useful
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { usefulness: "NOT_USEFUL" }, "Marked as not useful.")}>
                        Not useful
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { approval: "APPROVE" }, "Approved output.")}>
                        Approve
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => submitFeedback(request.id, { approval: "REJECT" }, "Rejected output.")}>
                        Reject
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => addNote(request.id, request.feedback?.reviewerNote)}>
                        Note
                      </button>
                      <button className="ops-button" disabled={busyId === request.id} onClick={() => setExpectedOutput(request.id, request.feedback?.expectedOutputJson)}>
                        Expected JSON
                      </button>
                    </div>

                    <div className="mt-3 text-sm text-[var(--ops-muted)]">
                      <p>Correctness: {request.feedback?.correctness ?? "pending"}</p>
                      <p>Usefulness: {request.feedback?.usefulness ?? "pending"}</p>
                      <p>Approval: {request.feedback?.approval ?? "pending"}</p>
                      {request.feedback?.expectedOutputJson ? (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/20 px-3 py-2 text-xs text-white">
                          {JSON.stringify(request.feedback.expectedOutputJson, null, 2)}
                        </pre>
                      ) : null}
                      {request.feedback?.reviewerNote ? (
                        <p className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-white">
                          {request.feedback.reviewerNote}
                        </p>
                      ) : null}
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
