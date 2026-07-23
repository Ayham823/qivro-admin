import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  GitBranch,
  HeartPulse,
  PackageCheck,
  Rocket,
  Server,
  ShieldCheck,
  Undo2,
} from "lucide-react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import OpsPageHeader from "@/components/OpsPageHeader"
import { integrations } from "@/lib/integrations"

const releaseChecks = [
  { icon: PackageCheck, label: "Immutable image tags", detail: "Deploy a commit SHA, never an untraceable latest image." },
  { icon: Database, label: "Backup and migrations", detail: "Create a database backup before Prisma migrate deploy." },
  { icon: HeartPulse, label: "Health and smoke checks", detail: "Verify API, admin, frontend, AI, and critical product flows." },
  { icon: Undo2, label: "Rollback reference", detail: "Keep the previous image tags and matching recovery notes." },
]

export default function DeploymentsPage() {
  const github = integrations.find((integration) => integration.key === "github")

  return (
    <GuardedOpsShell>
      <OpsPageHeader
        eyebrow="Delivery pipeline"
        title="Deployments"
        description="The release contract from reviewed source code to verified staging and production containers."
        actions={github?.url
          ? <a href={github.url} target="_blank" rel="noreferrer" className="ops-button">Open GitHub <ArrowUpRight size={15} /></a>
          : <span className="status-badge is-warning">GitHub URL missing</span>}
      />

      <section className="deployment-environments" aria-label="Qivro environments">
        <EnvironmentCard name="Local" detail="Docker Compose development stack" state="Developer controlled" tone="local" />
        <ArrowRight aria-hidden="true" />
        <EnvironmentCard name="Staging" detail="Production-like verification environment" state="Promotion gate" tone="staging" />
        <ArrowRight aria-hidden="true" />
        <EnvironmentCard name="Production" detail="Immutable release for real users" state="Approval required" tone="production" />
      </section>

      <section className="deployment-flow" aria-label="Deployment flow">
        <FlowStep number="01" icon={GitBranch} title="Review source" detail="Protected branches, pull requests, and required CI checks." />
        <FlowStep number="02" icon={PackageCheck} title="Publish images" detail="GitHub Actions builds and publishes commit-tagged Docker images." />
        <FlowStep number="03" icon={Server} title="Promote release" detail="The target environment pulls the exact approved image tags." />
        <FlowStep number="04" icon={Rocket} title="Verify operation" detail="Migrations, health checks, smoke tests, and release evidence complete the deploy." />
      </section>

      <section className="release-contract">
        <header>
          <div><p className="command-eyebrow">Release safety</p><h2>Required production checks</h2></div>
          <span className="ops-summary-chip">4 controls</span>
        </header>
        <div>
          {releaseChecks.map((check) => {
            const Icon = check.icon
            return (
              <article key={check.label}>
                <Icon size={18} />
                <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                <CheckCircle2 size={17} />
              </article>
            )
          })}
        </div>
      </section>

      <section className={`deployment-live-boundary ${github?.url ? "is-connected" : "is-missing"}`}>
        <ShieldCheck size={20} />
        <div>
          <h2>Authenticated deployment data</h2>
          <p>{github?.url
            ? "The GitHub console is connected for direct navigation. Workflow runs still require a backend GitHub App integration before they can be displayed safely here."
            : `Set ${github?.envKey ?? "NEXT_PUBLIC_GITHUB_URL"} for console access. Add a backend GitHub App later for live workflow and commit status without exposing credentials in the browser.`}</p>
        </div>
      </section>
    </GuardedOpsShell>
  )
}

function FlowStep({ number, icon: Icon, title, detail }: { number: string; icon: LucideIcon; title: string; detail: string }) {
  return (
    <article>
      <div><Icon size={21} /></div>
      <small>{number}</small>
      <span>{title}</span>
      <p>{detail}</p>
    </article>
  )
}

function EnvironmentCard({ name, detail, state, tone }: { name: string; detail: string; state: string; tone: string }) {
  return (
    <article className={`is-${tone}`}>
      <span>{name}</span>
      <strong>{state}</strong>
      <p>{detail}</p>
    </article>
  )
}
