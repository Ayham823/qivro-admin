"use client"

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CircleOff,
  Cloud,
  GitBranch,
  KeyRound,
  Link2,
} from "lucide-react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import OpsPageHeader from "@/components/OpsPageHeader"
import { integrations, type IntegrationDefinition } from "@/lib/integrations"

type Category = IntegrationDefinition["category"]
type Filter = "All" | Category

const categories: Category[] = ["Analytics", "Monitoring", "Engineering", "Cloud", "Revenue"]

const categoryIcons: Record<Category, LucideIcon> = {
  Analytics: BarChart3,
  Monitoring: Activity,
  Engineering: GitBranch,
  Cloud,
  Revenue: CircleDollarSign,
}

export default function IntegrationsPage() {
  const [filter, setFilter] = useState<Filter>("All")
  const configured = integrations.filter((integration) => integration.url).length
  const visibleGroups = useMemo(() => {
    const selected = filter === "All" ? categories : [filter]
    return selected.map((category) => ({
      category,
      items: integrations.filter((integration) => integration.category === category),
    }))
  }, [filter])

  return (
    <GuardedOpsShell>
      <OpsPageHeader
        eyebrow="External services"
        title="Connected services"
        description="One launch point for analytics, errors, cloud operations, source control, monitoring, and revenue consoles."
        actions={<span className="ops-summary-chip">{configured}/{integrations.length} configured</span>}
      />

      <section className="integration-summary" aria-label="Integration readiness">
        <Summary label="Connected" value={`${configured}`} tone="healthy" />
        <Summary label="Missing URLs" value={`${integrations.length - configured}`} tone={configured === integrations.length ? "healthy" : "warning"} />
        <Summary label="Service groups" value={`${categories.length}`} />
        <Summary label="Secrets exposed" value="0" tone="healthy" />
      </section>

      <div className="integration-filter" role="group" aria-label="Filter integrations by category">
        {(["All", ...categories] as Filter[]).map((category) => (
          <button
            key={category}
            type="button"
            className={filter === category ? "is-active" : ""}
            onClick={() => setFilter(category)}
          >
            {category}
            <span>{category === "All" ? integrations.length : integrations.filter((integration) => integration.category === category).length}</span>
          </button>
        ))}
      </div>

      <div className="integration-sections">
        {visibleGroups.map(({ category, items }) => {
          const Icon = categoryIcons[category]
          const connected = items.filter((integration) => integration.url).length

          return (
            <section key={category} className="integration-section">
              <header>
                <div><Icon size={18} /><div><h2>{category}</h2><p>{connected}/{items.length} connected</p></div></div>
                <span className={`status-badge ${connected === items.length ? "is-healthy" : "is-warning"}`}>
                  {connected === items.length ? "Ready" : "Setup required"}
                </span>
              </header>

              <div className="integration-grid">
                {items.map((integration) => (
                  <article key={integration.key} className={`integration-card ${integration.url ? "is-connected" : "is-missing"}`}>
                    <div className="integration-card-top">
                      <span className="integration-category">{integration.category}</span>
                      {integration.url
                        ? <CheckCircle2 size={18} className="integration-ok" />
                        : <CircleOff size={18} className="integration-off" />}
                    </div>
                    <h3>{integration.name}</h3>
                    <p>{integration.description}</p>
                    {integration.url ? (
                      <a href={integration.url} target="_blank" rel="noreferrer" className="ops-button integration-open">
                        Open console <ArrowUpRight size={15} />
                      </a>
                    ) : (
                      <div className="integration-configure">
                        <span>Configuration key</span>
                        <code>{integration.envKey}</code>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <section className="integration-boundary" aria-label="Integration security model">
        <div><Link2 size={18} /><span><strong>Browser-safe console URLs</strong><p>Only navigation links are compiled into the admin application.</p></span></div>
        <div><KeyRound size={18} /><span><strong>Private credentials stay server-side</strong><p>API tokens belong in the backend, GitHub Secrets, AWS SSM, or Secrets Manager.</p></span></div>
      </section>
    </GuardedOpsShell>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "healthy" | "warning" }) {
  return <article className={tone ? `is-${tone}` : ""}><span>{label}</span><strong>{value}</strong></article>
}
