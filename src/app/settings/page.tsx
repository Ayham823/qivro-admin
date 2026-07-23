import GuardedOpsShell from "@/components/GuardedOpsShell"

export default function SettingsPage() {
  return (
    <GuardedOpsShell>
      <div className="ops-page-heading"><div><p className="command-eyebrow">Command center</p><h1>Settings</h1><p>Environment boundaries and admin application configuration.</p></div></div>
      <div className="settings-grid">
        <section className="ops-card"><h2>API connection</h2><dl><div><dt>Server API</dt><dd>{process.env.NEXT_PUBLIC_API_URL ?? "Not configured"}</dd></div><div><dt>Browser API</dt><dd>{process.env.NEXT_PUBLIC_BROWSER_API_URL ?? "Not configured"}</dd></div></dl></section>
        <section className="ops-card"><h2>Security</h2><p>Admin access is verified against the backend `ADMIN` role. Private integration tokens must never be placed in public environment variables.</p></section>
        <section className="ops-card"><h2>Release ownership</h2><p>This standalone application owns its dependencies, Docker image, CI checks, environment variables, and deployment cadence.</p></section>
      </div>
    </GuardedOpsShell>
  )
}
