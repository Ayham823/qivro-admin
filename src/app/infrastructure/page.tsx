"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Server,
  TriangleAlert,
  Workflow,
} from "lucide-react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import OpsPageHeader from "@/components/OpsPageHeader"
import { LoadingBlock } from "@/components/StateBlock"
import {
  apiRequest,
  getTours,
  type OpsHealthBlock,
  type OpsSystemHealth,
  type OpsToursDashboard,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

type SourceErrors = {
  health?: string
  tours?: string
}

type HealthTone = "healthy" | "warning" | "critical"

function statusTone(status?: string): HealthTone {
  const value = status?.toLowerCase() ?? ""
  if (value.includes("not configured")) return "warning"
  if (["healthy", "operational", "configured", "ready", "ok", "up"].some((item) => value.includes(item))) {
    return "healthy"
  }
  if (["down", "failed", "error", "unavailable", "unhealthy"].some((item) => value.includes(item))) {
    return "critical"
  }
  return "warning"
}

function latencyLabel(dependency?: OpsHealthBlock) {
  return typeof dependency?.latencyMs === "number" ? `${dependency.latencyMs} ms` : "Not reported"
}

export default function InfrastructurePage() {
  const [health, setHealth] = useState<OpsSystemHealth | null>(null)
  const [tours, setTours] = useState<OpsToursDashboard | null>(null)
  const [sourceErrors, setSourceErrors] = useState<SourceErrors>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (refresh = false) => {
    const token = getToken()
    if (!token) return

    if (refresh) setRefreshing(true)
    else setLoading(true)

    const [healthResult, toursResult] = await Promise.allSettled([
      apiRequest<OpsSystemHealth>("/admin/system/health", { token }),
      getTours(token, new URLSearchParams({ limit: "1" })),
    ])

    const nextErrors: SourceErrors = {}

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value)
    } else {
      nextErrors.health = healthResult.reason instanceof Error
        ? healthResult.reason.message
        : "Core service health is unavailable"
    }

    if (toursResult.status === "fulfilled") {
      setTours(toursResult.value)
    } else {
      nextErrors.tours = toursResult.reason instanceof Error
        ? toursResult.reason.message
        : "Worker and tour status is unavailable"
    }

    setSourceErrors(nextErrors)
    setLastUpdated(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const coreStatuses = [
      health?.backend.status,
      health?.database.status,
      health?.redis.status,
      health?.ai.status,
    ].filter((status): status is string => Boolean(status))
    const healthy = coreStatuses.filter((status) => statusTone(status) === "healthy").length
    const latencies = [health?.database.latencyMs, health?.redis.latencyMs, health?.ai.latencyMs]
      .filter((latency): latency is number => typeof latency === "number")
    const averageLatency = latencies.length
      ? Math.round(latencies.reduce((total, latency) => total + latency, 0) / latencies.length)
      : null
    const workerIssues = (tours?.summary.failedJobs ?? 0) + (tours?.summary.staleJobs ?? 0)
    const hasCritical = coreStatuses.some((status) => statusTone(status) === "critical")
    const hasWarning = Object.keys(sourceErrors).length > 0 || workerIssues > 0 || healthy < coreStatuses.length
    const overallTone: HealthTone = hasCritical ? "critical" : hasWarning ? "warning" : health ? "healthy" : "critical"

    return {
      overall: hasCritical ? "Action required" : hasWarning ? "Needs review" : health ? "Operational" : "Unavailable",
      overallTone,
      healthy,
      coreTotal: coreStatuses.length,
      averageLatency,
      workerIssues,
    }
  }, [health, sourceErrors, tours])

  return (
    <GuardedOpsShell>
      <OpsPageHeader
        eyebrow="Engineering operations"
        title="System health"
        description="Live dependency checks, queue pressure, worker signals, and the boundary to cloud monitoring."
        actions={(
          <>
            <span className="command-freshness">
              <Clock3 size={14} />
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for health data"}
            </span>
            <button type="button" className="ops-button" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </>
        )}
      />

      {loading && !health && !tours ? <LoadingBlock label="Checking Qivro infrastructure..." /> : null}

      {Object.keys(sourceErrors).length ? (
        <section className="ops-source-alert" aria-label="Unavailable health sources">
          <TriangleAlert size={18} />
          <div>
            <strong>Some operational data could not be refreshed</strong>
            <p>{Object.entries(sourceErrors).map(([source, message]) => `${source}: ${message}`).join(" | ")}</p>
          </div>
          <button type="button" onClick={() => void load(true)}>Retry</button>
        </section>
      ) : null}

      <section className="infra-summary" aria-label="Infrastructure summary">
        <SummaryCard label="Overall state" value={summary.overall} tone={summary.overallTone} />
        <SummaryCard label="Healthy core services" value={`${summary.healthy}/${Math.max(summary.coreTotal, 4)}`} />
        <SummaryCard label="Average dependency latency" value={summary.averageLatency === null ? "--" : `${summary.averageLatency} ms`} />
        <SummaryCard label="Worker issues" value={`${summary.workerIssues}`} tone={summary.workerIssues ? "warning" : "healthy"} />
      </section>

      <section className="infra-grid" aria-label="Service status">
        <InfraCard
          icon={Server}
          name="Backend API"
          status={health?.backend.status ?? "Unavailable"}
          detail={health?.backend.environment ? `Environment: ${health.backend.environment}` : "NestJS application API"}
        />
        <InfraCard
          icon={Database}
          name="PostgreSQL"
          status={health?.database.status ?? "Unavailable"}
          detail={`Primary application database - ${latencyLabel(health?.database)}`}
          message={health?.database.message}
        />
        <InfraCard
          icon={Workflow}
          name="Redis"
          status={health?.redis.status ?? "Unavailable"}
          detail={`Cache and BullMQ transport - ${latencyLabel(health?.redis)}`}
          message={health?.redis.message}
        />
        <InfraCard
          icon={Bot}
          name="AI service"
          status={health?.ai.status ?? "Unavailable"}
          detail={`FastAPI model orchestration - ${latencyLabel(health?.ai)}`}
          message={health?.ai.message}
        />
        <InfraCard
          icon={Activity}
          name="Tour workers"
          status={!tours ? "Unavailable" : summary.workerIssues ? "Needs review" : "Operational"}
          detail={tours
            ? `${tours.summary.queuedJobs} queued - ${tours.summary.processingJobs} processing - ${tours.summary.failedJobs} failed`
            : sourceErrors.tours ?? "Worker metrics were not returned"}
        />
        <InfraCard
          icon={Activity}
          name="PostHog forwarding"
          status={health?.posthog.configured ? "Configured" : "Not configured"}
          detail={health?.posthog.host ?? "No forwarding host reported"}
        />
      </section>

      <section className="infra-map" aria-label="Internal service map">
        <header>
          <div>
            <p className="command-eyebrow">Internal connections</p>
            <h2>Request and job path</h2>
          </div>
          <span>Docker network</span>
        </header>
        <div className="infra-map-flow">
          <ServiceNode icon={Server} label="Admin" detail="HTTPS / JSON" />
          <ArrowRight aria-hidden="true" />
          <ServiceNode icon={Server} label="Backend API" detail="Auth and orchestration" />
          <ArrowRight aria-hidden="true" />
          <div className="infra-map-targets">
            <ServiceNode icon={Database} label="PostgreSQL" detail="Persistent data" compact />
            <ServiceNode icon={Workflow} label="Redis / BullMQ" detail="Cache and jobs" compact />
            <ServiceNode icon={Bot} label="AI service" detail="Model workloads" compact />
          </div>
        </div>
      </section>

      <section className="infra-actions" aria-label="Infrastructure actions">
        <Link href="/tours"><Activity size={17} /><span><strong>Review worker queues</strong><small>Inspect failed, stale, and processing tour jobs.</small></span><ArrowRight size={15} /></Link>
        <Link href="/integrations"><Workflow size={17} /><span><strong>Open monitoring consoles</strong><small>CloudWatch, Grafana, Sentry, and AWS links.</small></span><ArrowRight size={15} /></Link>
        <Link href="/deployments"><CheckCircle2 size={17} /><span><strong>Review release contract</strong><small>Images, migrations, health checks, and smoke tests.</small></span><ArrowRight size={15} /></Link>
      </section>

      <section className="ops-card infra-runbook">
        <h2>Operational boundary</h2>
        <p>This page reads dependency checks exposed by the Qivro backend. Host CPU, memory, disk, container restarts, SSL expiry, and AWS alarms remain in CloudWatch or Grafana until authenticated monitoring APIs are connected through the backend.</p>
      </section>
    </GuardedOpsShell>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: HealthTone }) {
  return <article className={tone ? `is-${tone}` : ""}><span>{label}</span><strong>{value}</strong></article>
}

function InfraCard({
  icon: Icon,
  name,
  status,
  detail,
  message,
}: {
  icon: LucideIcon
  name: string
  status: string
  detail: string
  message?: string
}) {
  const tone = statusTone(status)
  return (
    <article className={`infra-card is-${tone}`}>
      <div className="infra-icon"><Icon size={20} /></div>
      <div>
        <h2>{name}</h2>
        <p>{detail}</p>
        {message ? <small>{message}</small> : null}
      </div>
      <span className={`status-badge is-${tone}`}>{status}</span>
    </article>
  )
}

function ServiceNode({ icon: Icon, label, detail, compact = false }: { icon: LucideIcon; label: string; detail: string; compact?: boolean }) {
  return (
    <div className={`infra-service-node ${compact ? "is-compact" : ""}`}>
      <Icon size={18} />
      <span><strong>{label}</strong><small>{detail}</small></span>
    </div>
  )
}
