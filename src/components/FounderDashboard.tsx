"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Clock3,
  Database,
  GitBranch,
  Layers3,
  RefreshCw,
  Server,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react"
import {
  apiRequest,
  getMetrics,
  getTours,
  type OpsAiMetrics,
  type OpsMetricsDashboard,
  type OpsOverview,
  type OpsSystemHealth,
  type OpsToursDashboard,
} from "@/lib/api"
import { getToken } from "@/lib/auth"
import { integrations } from "@/lib/integrations"

type DashboardData = {
  overview?: OpsOverview
  metrics?: OpsMetricsDashboard
  ai?: OpsAiMetrics
  health?: OpsSystemHealth
  tours?: OpsToursDashboard
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

function statusTone(status?: string) {
  const value = status?.toLowerCase() ?? ""
  if (["healthy", "ok", "operational", "configured", "up"].some((item) => value.includes(item))) {
    return "healthy"
  }
  if (["failed", "down", "error", "unhealthy"].some((item) => value.includes(item))) {
    return "critical"
  }
  return "warning"
}

export default function FounderDashboard() {
  const [data, setData] = useState<DashboardData>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [failures, setFailures] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (refresh = false) => {
    const token = getToken()
    if (!token) return

    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const requests = await Promise.allSettled([
      apiRequest<OpsOverview>("/admin/overview", { token }),
      getMetrics(token),
      apiRequest<OpsAiMetrics>("/admin/ai/metrics", { token }),
      apiRequest<OpsSystemHealth>("/admin/system/health", { token }),
      getTours(token, new URLSearchParams({ limit: "6" })),
    ])

    const names = ["business overview", "analytics", "AI usage", "system health", "3D tours"]
    const nextFailures: string[] = []
    requests.forEach((request, index) => {
      if (request.status === "rejected") nextFailures.push(names[index])
    })

    setData({
      overview: requests[0].status === "fulfilled" ? requests[0].value : undefined,
      metrics: requests[1].status === "fulfilled" ? requests[1].value : undefined,
      ai: requests[2].status === "fulfilled" ? requests[2].value : undefined,
      health: requests[3].status === "fulfilled" ? requests[3].value : undefined,
      tours: requests[4].status === "fulfilled" ? requests[4].value : undefined,
    })
    setFailures(nextFailures)
    setLastUpdated(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const alerts = useMemo(() => {
    const items: Array<{ tone: "critical" | "warning" | "positive"; title: string; detail: string; href: string }> = []
    const failedTours = data.tours?.summary.failedTours ?? 0
    const failedAi = data.ai?.requests.failed ?? 0
    const unread = data.overview?.executive.unreadNotifications ?? 0

    if (failures.length) {
      items.push({
        tone: "critical",
        title: `${failures.length} data sources unavailable`,
        detail: failures.join(", "),
        href: "/infrastructure",
      })
    }
    if (failedTours > 0) {
      items.push({
        tone: "critical",
        title: `${failedTours} failed 3D tours`,
        detail: "Processing failures need review.",
        href: "/tours",
      })
    }
    if (failedAi > 0) {
      items.push({
        tone: "warning",
        title: `${failedAi} AI requests failed`,
        detail: "Inspect providers, fallbacks, and error messages.",
        href: "/ai",
      })
    }
    if (unread > 0) {
      items.push({
        tone: "warning",
        title: `${unread} unread notifications`,
        detail: "Operations signals are waiting for review.",
        href: "/audit",
      })
    }
    if (!items.length && !loading) {
      items.push({
        tone: "positive",
        title: "No critical alerts",
        detail: "Qivro is reporting normal operating signals.",
        href: "/infrastructure",
      })
    }
    return items.slice(0, 4)
  }, [data, failures, loading])

  const focusItems = useMemo(() => {
    const items: string[] = []
    const failedTours = data.tours?.summary.failedTours ?? 0
    const failedAi = data.ai?.requests.failed ?? 0
    const unread = data.overview?.executive.unreadNotifications ?? 0

    if (failures.length) items.push(`Restore ${failures.length} unavailable data source${failures.length === 1 ? "" : "s"}.`)
    if (failedTours) items.push(`Resolve ${failedTours} failed 3D tour${failedTours === 1 ? "" : "s"}.`)
    if (failedAi) items.push(`Review ${failedAi} failed AI request${failedAi === 1 ? "" : "s"} and fallbacks.`)
    if (unread) items.push(`Triage ${unread} unread operations notification${unread === 1 ? "" : "s"}.`)

    if (!items.length) {
      items.push("Review lead conversion and marketplace activity.")
      items.push("Confirm production backups and monitoring signals.")
      items.push("Inspect AI cost, latency, and response quality.")
    }

    return items.slice(0, 4)
  }, [data, failures])

  const overview = data.overview?.executive
  const metrics = data.metrics?.overview
  const ai = data.ai?.requests
  const tourStatuses = data.tours?.summary.byStatus ?? []
  const configuredIntegrations = integrations.filter((integration) => integration.url)

  return (
    <div className="command-center">
      <header className="command-heading">
        <div>
          <p className="command-eyebrow">Founder command center</p>
          <h1>Mission control</h1>
          <p>Live business, product, AI, 3D, and infrastructure signals in one operating view.</p>
        </div>
        <div className="command-heading-actions">
          <span className="command-freshness">
            <Clock3 size={14} />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for live data"}
          </span>
          <button type="button" className="ops-button command-refresh" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
            {refreshing ? "Refreshing" : "Refresh data"}
          </button>
        </div>
      </header>

      <section className="mission-strip" aria-label="Priority alerts">
        {loading ? (
          <div className="mission-card is-loading">Loading priority signals...</div>
        ) : (
          alerts.map((alert) => (
            <Link key={`${alert.title}-${alert.href}`} href={alert.href} className={`mission-card is-${alert.tone}`}>
              {alert.tone === "positive" ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          ))
        )}
      </section>

      <section className="command-kpis" aria-label="Key business metrics">
        <MetricCard icon={CircleDollarSign} label="Revenue" value={overview ? money.format(overview.paymentsTotal) : "--"} hint={`${overview?.paidPayments ?? 0} paid payments`} tone="green" />
        <MetricCard icon={Users} label="Users" value={overview ? integer.format(overview.totalUsers) : "--"} hint={`${metrics?.activeUsersOrSessions ?? 0} active users or sessions`} tone="blue" />
        <MetricCard icon={Building2} label="Listings" value={overview ? integer.format(overview.totalListings) : "--"} hint={`${overview?.totalViews ?? 0} total views`} tone="cyan" />
        <MetricCard icon={Workflow} label="Leads" value={overview ? integer.format(overview.totalLeads) : "--"} hint={`${overview?.conversionRate ?? 0}% conversion`} tone="green" />
        <MetricCard icon={Layers3} label="3D Tours" value={data.tours ? integer.format(data.tours.summary.total) : "--"} hint={`${data.tours?.summary.readyRate ?? 0}% ready`} tone="amber" />
        <MetricCard icon={Bot} label="AI Requests" value={ai ? integer.format(ai.total) : "--"} hint={`${ai?.cacheHits ?? 0} cache hits`} tone="magenta" />
      </section>

      <section className="command-grid command-grid-primary">
        <article className="command-panel command-health">
          <PanelHeader title="System health" href="/infrastructure" />
          <div className="health-layout">
            <div className="health-list">
              <HealthRow icon={Server} label="Backend API" status={data.health?.backend.status ?? "Unavailable"} />
              <HealthRow icon={Database} label="PostgreSQL" status={data.health?.database.status ?? "Unavailable"} />
              <HealthRow icon={Bot} label="AI service" status={data.health?.ai.status ?? "Unavailable"} />
              <HealthRow icon={Workflow} label="Redis / BullMQ" status={data.health?.redis.status ?? "Unavailable"} />
              <HealthRow icon={Cloud} label="PostHog forwarding" status={data.health?.posthog.configured ? "Configured" : "Not configured"} />
            </div>
            <div className="health-score">
              <strong>{failures.length ? "Review" : "Live"}</strong>
              <span>{failures.length ? `${failures.length} sources failed` : "Core services responding"}</span>
            </div>
          </div>
        </article>

        <article className="command-panel">
          <PanelHeader title="3D tour pipeline" href="/tours" />
          <div className="pipeline-list">
            {tourStatuses.length ? tourStatuses.map((item) => (
              <div key={item.value} className="pipeline-stage">
                <div className="pipeline-stage-top">
                  <span>{item.value.replaceAll("_", " ")}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="pipeline-track"><span style={{ width: `${Math.min(100, (item.count / Math.max(1, data.tours?.summary.total ?? 1)) * 100)}%` }} /></div>
              </div>
            )) : <p className="command-muted">No tour pipeline data is available yet.</p>}
          </div>
          <div className="pipeline-summary">
            <span><strong>{data.tours?.summary.queuedJobs ?? 0}</strong> queued</span>
            <span><strong>{data.tours?.summary.processingJobs ?? 0}</strong> processing</span>
            <span><strong>{data.tours?.summary.failedJobs ?? 0}</strong> failed jobs</span>
          </div>
        </article>
      </section>

      <section className="command-grid command-grid-secondary">
        <article className="command-panel">
          <PanelHeader title="AI operations" href="/ai" />
          <div className="ai-summary-grid">
            <DataPoint label="Success" value={ai ? `${ai.success}` : "--"} />
            <DataPoint label="Failed" value={ai ? `${ai.failed}` : "--"} tone={ai?.failed ? "danger" : undefined} />
            <DataPoint label="Fallbacks" value={ai ? `${ai.fallback}` : "--"} />
            <DataPoint label="P95 latency" value={ai ? `${ai.latency.p95} ms` : "--"} />
          </div>
          <div className="endpoint-list">
            {(ai?.byEndpoint ?? []).slice(0, 5).map((endpoint) => (
              <div key={endpoint.value}>
                <span>{endpoint.value}</span>
                <strong>{endpoint.count} calls</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="command-panel">
          <PanelHeader title="Product funnel" href="/metrics" />
          <div className="funnel-list">
            {(data.metrics?.funnel ?? []).slice(0, 6).map((step, index) => (
              <div key={step.step} className="funnel-step">
                <span className="funnel-index">{index + 1}</span>
                <div>
                  <strong>{step.step}</strong>
                  <span>{step.rateFromVisit}% from visit</span>
                </div>
                <b>{integer.format(step.count)}</b>
              </div>
            ))}
            {!data.metrics?.funnel.length ? <p className="command-muted">Funnel data is not available.</p> : null}
          </div>
        </article>

        <article className="command-panel">
          <PanelHeader title="Connected consoles" href="/integrations" />
          <div className="connector-list">
            {integrations.slice(0, 7).map((integration) => (
              integration.url ? (
                <a key={integration.key} href={integration.url} target="_blank" rel="noreferrer" className="connector-row">
                  {integration.key === "github" ? <GitBranch size={16} /> : <Cloud size={16} />}
                  <span>{integration.name}</span>
                  <b>Open</b>
                </a>
              ) : (
                <div key={integration.key} className="connector-row is-disabled">
                  <Cloud size={16} />
                  <span>{integration.name}</span>
                  <b>Not configured</b>
                </div>
              )
            ))}
          </div>
          <p className="command-footnote">{configuredIntegrations.length} of {integrations.length} external consoles configured.</p>
        </article>
      </section>

      <section className="command-grid command-grid-bottom">
        <article className="command-panel">
          <PanelHeader title="Top platform events" href="/metrics" />
          <div className="event-grid">
            {(data.overview?.eventPipeline.topEvents ?? []).slice(0, 8).map((event) => (
              <div key={event.type}>
                <Activity size={15} />
                <span>{event.type.replaceAll("_", " ")}</span>
                <strong>{integer.format(event.count)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="command-panel command-focus">
          <PanelHeader title="Today’s focus" href="/audit" />
          <ul>
            {focusItems.map((focus) => <li key={focus}>{focus}</li>)}
          </ul>
        </article>
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Activity; label: string; value: string; hint: string; tone: string }) {
  return (
    <article className={`command-metric tone-${tone}`}>
      <div><span>{label}</span><Icon size={17} /></div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  )
}

function PanelHeader({ title, href }: { title: string; href: string }) {
  return (
    <header className="panel-heading">
      <h2>{title}</h2>
      <Link href={href}>View all <ArrowUpRight size={14} /></Link>
    </header>
  )
}

function HealthRow({ icon: Icon, label, status }: { icon: typeof Activity; label: string; status: string }) {
  const tone = statusTone(status)
  return (
    <div className="health-row">
      <span><Icon size={16} />{label}</span>
      <b className={`status-badge is-${tone}`}>{status}</b>
    </div>
  )
}

function DataPoint({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return <div className={tone === "danger" ? "is-danger" : ""}><span>{label}</span><strong>{value}</strong></div>
}
