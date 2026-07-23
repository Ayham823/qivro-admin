"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  Eye,
  FileClock,
  Languages,
  RefreshCw,
  Save,
  ScanSearch,
  Send,
  ShieldCheck,
  X,
} from "lucide-react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { useToast } from "@/components/Toast"
import {
  generateMissingTranslation,
  getListingTranslations,
  getMissingTranslations,
  getTranslationAudit,
  getTranslations,
  runTranslationAction,
  updateTranslation,
  type OpsListingTranslation,
  type OpsListingTranslationBundle,
  type OpsMissingTranslation,
  type OpsTranslationAudit,
  type Paginated,
  type TranslationLocale,
  type TranslationStatus,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

const locales: Array<{ value: TranslationLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "he", label: "Hebrew" },
]

const statuses: TranslationStatus[] = [
  "PENDING",
  "GENERATED",
  "REVIEWED",
  "PUBLISHED",
  "REJECTED",
  "STALE",
]

type WorkspaceMode = "review" | "missing"
type TranslationAction =
  | "approve"
  | "mark-reviewed"
  | "reject"
  | "publish"
  | "regenerate"

function formatDate(value?: string | null) {
  if (!value) return "Not recorded"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function localeLabel(locale: string) {
  return locales.find((item) => item.value === locale)?.label ?? locale
}

function statusClass(status: TranslationStatus, stale = false) {
  if (stale || status === "STALE") return "is-stale"
  if (status === "PUBLISHED") return "is-published"
  if (status === "REVIEWED") return "is-reviewed"
  if (status === "REJECTED") return "is-rejected"
  return "is-generated"
}

export default function TranslationCenterPage() {
  const [mode, setMode] = useState<WorkspaceMode>("review")
  const [translations, setTranslations] = useState<Paginated<OpsListingTranslation> | null>(null)
  const [missing, setMissing] = useState<Paginated<OpsMissingTranslation> | null>(null)
  const [selected, setSelected] = useState<OpsListingTranslation | null>(null)
  const [bundle, setBundle] = useState<OpsListingTranslationBundle | null>(null)
  const [audit, setAudit] = useState<OpsTranslationAudit[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [previewLocale, setPreviewLocale] = useState<TranslationLocale>("en")
  const [locale, setLocale] = useState<TranslationLocale>("ar")
  const [status, setStatus] = useState("")
  const [staleOnly, setStaleOnly] = useState(false)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState("")
  const [error, setError] = useState("")
  const { showToast, ToastHost } = useToast()

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  useEffect(() => {
    const token = getToken()
    if (!token) return

    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      locale,
    })
    if (q.trim()) params.set("q", q.trim())
    if (status) params.set("status", status)
    if (staleOnly) params.set("stale", "true")

    setLoading(true)
    setError("")
    const request =
      mode === "review"
        ? getTranslations(token, params).then((result) => {
            setTranslations(result)
            setMissing(null)
          })
        : getMissingTranslations(token, params).then((result) => {
            setMissing(result)
            setTranslations(null)
          })

    request
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to load translations")
      })
      .finally(() => setLoading(false))
  }, [locale, mode, page, q, refreshKey, staleOnly, status])

  const loadDetails = useCallback(async (translation: OpsListingTranslation) => {
    const token = getToken()
    if (!token) return
    setSelected(translation)
    setTitle(translation.title)
    setDescription(translation.description)
    setPreviewLocale(translation.locale)
    setRejectionReason("")
    setDetailLoading(true)
    try {
      const [nextBundle, nextAudit] = await Promise.all([
        getListingTranslations(token, translation.listingId),
        getTranslationAudit(token, translation.id),
      ])
      setBundle(nextBundle)
      setAudit(nextAudit)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Failed to load translation details", "error")
    } finally {
      setDetailLoading(false)
    }
  }, [showToast])

  const reloadSelected = useCallback(async (translation: OpsListingTranslation) => {
    await loadDetails(translation)
    refresh()
  }, [loadDetails, refresh])

  const saveManualEdit = async () => {
    const token = getToken()
    if (!token || !selected || !title.trim() || !description.trim()) return
    setPendingAction("save")
    try {
      const updated = await updateTranslation(token, selected.id, {
        title: title.trim(),
        description: description.trim(),
      })
      showToast("Translation saved and marked as reviewed.", "success")
      await reloadSelected({ ...updated, stale: false })
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not save translation", "error")
    } finally {
      setPendingAction("")
    }
  }

  const performAction = async (action: TranslationAction) => {
    const token = getToken()
    if (!token || !selected) return
    if (action === "reject" && !rejectionReason.trim()) {
      showToast("Add a rejection reason first.", "error")
      return
    }
    if (
      (action === "publish" || action === "reject" || action === "regenerate") &&
      !window.confirm(`Confirm ${action.replace("-", " ")} for this translation?`)
    ) {
      return
    }

    setPendingAction(action)
    try {
      const updated = await runTranslationAction(
        token,
        selected.id,
        action,
        action === "reject" ? { reason: rejectionReason.trim() } : undefined
      )
      showToast(`Translation ${action.replace("-", " ")} completed.`, "success")
      await reloadSelected({ ...updated, stale: updated.status === "STALE" })
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Translation action failed", "error")
    } finally {
      setPendingAction("")
    }
  }

  const generateMissing = async (item: OpsMissingTranslation) => {
    const token = getToken()
    if (!token) return
    setPendingAction(`missing:${item.id}`)
    try {
      const generated = await generateMissingTranslation(token, item.id, item.missingLocale)
      showToast(`${localeLabel(item.missingLocale)} draft generated.`, "success")
      setMode("review")
      setStatus("GENERATED")
      await loadDetails({ ...generated, stale: false })
      refresh()
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not generate translation", "error")
    } finally {
      setPendingAction("")
    }
  }

  const preview = useMemo(() => {
    if (!bundle) return null
    if (previewLocale === bundle.sourceLocale) {
      return {
        title: bundle.originalTitle,
        description: bundle.originalDescription,
        status: "ORIGINAL",
      }
    }

    const versions = bundle.translations
      .filter((item) => item.locale === previewLocale)
      .sort((first, second) => second.version - first.version)
    const current =
      selected?.locale === previewLocale
        ? { ...selected, title, description }
        : versions[0]

    return current
      ? { title: current.title, description: current.description, status: current.status }
      : null
  }, [bundle, description, previewLocale, selected, title])

  const listItems = translations?.data ?? []
  const missingItems = missing?.data ?? []
  const meta = mode === "review" ? translations?.meta : missing?.meta

  return (
    <GuardedOpsShell>
      <ToastHost />
      <header className="translation-heading">
        <div>
          <p className="command-eyebrow">Localization operations</p>
          <h1>Translation Center</h1>
          <p>Review every listing translation before it reaches the public product.</p>
        </div>
        <button className="ops-button" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          Refresh
        </button>
      </header>

      <section className="translation-toolbar" aria-label="Translation filters">
        <div className="translation-tabs" role="tablist" aria-label="Translation queues">
          <button
            className={mode === "review" ? "is-active" : ""}
            onClick={() => { setMode("review"); setPage(1) }}
            role="tab"
            aria-selected={mode === "review"}
          >
            <Languages size={16} /> Review queue
          </button>
          <button
            className={mode === "missing" ? "is-active" : ""}
            onClick={() => { setMode("missing"); setPage(1); setStatus(""); setStaleOnly(false) }}
            role="tab"
            aria-selected={mode === "missing"}
          >
            <ScanSearch size={16} /> Missing scanner
          </button>
        </div>
        <input
          className="ops-input"
          value={q}
          onChange={(event) => { setQ(event.target.value); setPage(1) }}
          placeholder="Search title, city, or translated text"
          aria-label="Search translations"
        />
        <select
          className="ops-input"
          value={locale}
          onChange={(event) => { setLocale(event.target.value as TranslationLocale); setPage(1) }}
          aria-label="Target language"
        >
          {locales.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {mode === "review" ? (
          <>
            <select
              className="ops-input"
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1) }}
              aria-label="Translation status"
            >
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="translation-check">
              <input
                type="checkbox"
                checked={staleOnly}
                onChange={(event) => { setStaleOnly(event.target.checked); setPage(1) }}
              />
              Stale only
            </label>
          </>
        ) : null}
      </section>

      {error ? <ErrorBlock message={error} /> : null}
      {loading ? <LoadingBlock label="Loading translation workflow..." /> : null}

      {!loading && !error && mode === "review" && listItems.length === 0 ? (
        <EmptyBlock title="No translations match this view" description="Change the language or status filters, or open the missing scanner." />
      ) : null}

      {!loading && !error && mode === "missing" && missingItems.length === 0 ? (
        <EmptyBlock title="No missing translations" description={`Every eligible listing has an active ${localeLabel(locale)} translation.`} />
      ) : null}

      {!loading && mode === "missing" && missingItems.length > 0 ? (
        <section className="translation-missing-list">
          {missingItems.map((item) => (
            <article key={item.id} className="translation-missing-row">
              <div className="translation-language-mark">{item.missingLocale.toUpperCase()}</div>
              <div>
                <strong>{item.originalTitle}</strong>
                <p>{item.city} · source {item.sourceLocale.toUpperCase()} · {item.status}</p>
              </div>
              <button
                className="ops-button ops-button-primary"
                disabled={pendingAction === `missing:${item.id}`}
                onClick={() => void generateMissing(item)}
              >
                <RefreshCw size={15} />
                {pendingAction === `missing:${item.id}` ? "Generating..." : "Generate with AI"}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && mode === "review" && listItems.length > 0 ? (
        <div className="translation-workspace">
          <aside className="translation-queue" aria-label="Translation review queue">
            {listItems.map((item) => (
              <button
                key={item.id}
                className={`translation-queue-item ${selected?.id === item.id ? "is-selected" : ""}`}
                onClick={() => void loadDetails(item)}
              >
                <span className={`translation-status ${statusClass(item.status, item.stale)}`}>
                  {item.stale ? "STALE" : item.status}
                </span>
                <strong>{item.listing.originalTitle}</strong>
                <span>{item.listing.city} · {item.locale.toUpperCase()} · v{item.version}</span>
                <small>{item.provider || item.sourceType} {item.model ? `· ${item.model}` : ""}</small>
              </button>
            ))}
          </aside>

          <section className="translation-detail">
            {!selected ? (
              <div className="translation-select-prompt">
                <Eye size={28} />
                <h2>Select a translation</h2>
                <p>Choose an item from the queue to compare, edit, review, and publish it.</p>
              </div>
            ) : detailLoading ? (
              <LoadingBlock label="Loading translation history..." />
            ) : (
              <>
                <div className="translation-detail-head">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`translation-status ${statusClass(selected.status, selected.stale)}`}>
                        {selected.stale ? "STALE" : selected.status}
                      </span>
                      <span className="ops-pill">{localeLabel(selected.locale)}</span>
                      <span className="ops-pill">Version {selected.version}</span>
                    </div>
                    <h2>{selected.listing.originalTitle}</h2>
                    <p>{selected.listing.city} · source {selected.listing.sourceLocale.toUpperCase()}</p>
                  </div>
                  {selected.stale ? (
                    <div className="translation-stale-warning">
                      <AlertTriangle size={17} /> Source changed after this translation.
                    </div>
                  ) : null}
                </div>

                <div className="translation-compare">
                  <section>
                    <div className="translation-section-label">Original · {selected.listing.sourceLocale.toUpperCase()}</div>
                    <h3>{selected.listing.originalTitle}</h3>
                    <p>{selected.listing.originalDescription}</p>
                  </section>
                  <section>
                    <label className="translation-section-label" htmlFor="translation-title">Translated · {selected.locale.toUpperCase()}</label>
                    <input
                      id="translation-title"
                      className="ops-input translation-title-input"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={180}
                    />
                    <textarea
                      className="ops-input translation-description-input"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={5000}
                      aria-label="Translated description"
                    />
                    <button
                      className="ops-button ops-button-primary"
                      disabled={pendingAction === "save" || !title.trim() || !description.trim()}
                      onClick={() => void saveManualEdit()}
                    >
                      <Save size={15} /> {pendingAction === "save" ? "Saving..." : "Save manual edit"}
                    </button>
                  </section>
                </div>

                <dl className="translation-meta-grid">
                  <div><dt>Provider</dt><dd>{selected.provider || "Manual"}</dd></div>
                  <div><dt>Model</dt><dd>{selected.model || "Not applicable"}</dd></div>
                  <div><dt>Source type</dt><dd>{selected.sourceType}</dd></div>
                  <div><dt>Reviewed by</dt><dd>{selected.reviewedBy?.name || selected.reviewedBy?.email || "Pending"}</dd></div>
                  <div><dt>Reviewed at</dt><dd>{formatDate(selected.reviewedAt)}</dd></div>
                  <div><dt>Updated</dt><dd>{formatDate(selected.updatedAt)}</dd></div>
                </dl>

                <div className="translation-actions" aria-label="Translation actions">
                  <button className="ops-button" disabled={Boolean(pendingAction)} onClick={() => void performAction("approve")}>
                    <ShieldCheck size={15} /> Approve AI draft
                  </button>
                  <button className="ops-button" disabled={Boolean(pendingAction)} onClick={() => void performAction("mark-reviewed")}>
                    <Check size={15} /> Mark reviewed
                  </button>
                  <button className="ops-button" disabled={Boolean(pendingAction)} onClick={() => void performAction("regenerate")}>
                    <RefreshCw size={15} /> Regenerate
                  </button>
                  <button className="ops-button ops-button-primary" disabled={Boolean(pendingAction) || selected.status !== "REVIEWED" || selected.stale} onClick={() => void performAction("publish")}>
                    <Send size={15} /> Publish
                  </button>
                </div>

                <div className="translation-reject-row">
                  <input
                    className="ops-input"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Reason required before rejection"
                    maxLength={500}
                  />
                  <button className="ops-button translation-reject" disabled={Boolean(pendingAction) || !rejectionReason.trim()} onClick={() => void performAction("reject")}>
                    <X size={15} /> Reject
                  </button>
                </div>

                <section className="translation-preview">
                  <div className="translation-preview-head">
                    <div>
                      <span className="translation-section-label">Public preview</span>
                      <h3>Preview listing copy by language</h3>
                    </div>
                    <div className="translation-preview-tabs">
                      {locales.map((item) => (
                        <button key={item.value} className={previewLocale === item.value ? "is-active" : ""} onClick={() => setPreviewLocale(item.value)}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {preview ? (
                    <article dir={previewLocale === "en" ? "ltr" : "rtl"} lang={previewLocale}>
                      <span className="ops-pill">{preview.status}</span>
                      <h3>{preview.title}</h3>
                      <p>{preview.description}</p>
                    </article>
                  ) : (
                    <p className="translation-empty-preview">No {localeLabel(previewLocale)} translation exists yet.</p>
                  )}
                </section>

                <section className="translation-audit">
                  <div className="translation-preview-head">
                    <div>
                      <span className="translation-section-label">Immutable history</span>
                      <h3><FileClock size={17} /> Translation audit log</h3>
                    </div>
                  </div>
                  {audit.length ? audit.map((entry) => (
                    <article key={entry.id}>
                      <div>
                        <strong>{entry.action.replaceAll("_", " ")}</strong>
                        <span>{entry.actor.name || entry.actor.email} · {formatDate(entry.createdAt)}</span>
                      </div>
                      <details>
                        <summary>Inspect before / after</summary>
                        <div className="translation-audit-json">
                          <pre>{JSON.stringify(entry.before, null, 2)}</pre>
                          <pre>{JSON.stringify(entry.after, null, 2)}</pre>
                        </div>
                      </details>
                    </article>
                  )) : <p className="translation-empty-preview">No review actions recorded yet.</p>}
                </section>
              </>
            )}
          </section>
        </div>
      ) : null}

      {meta && meta.totalPages > 1 ? (
        <div className="translation-pagination">
          <button className="ops-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {meta.page} of {meta.totalPages} · {meta.total} records</span>
          <button className="ops-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      ) : null}
    </GuardedOpsShell>
  )
}
