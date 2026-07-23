import GuardedOpsShell from "@/components/GuardedOpsShell"
import FounderDashboard from "@/components/FounderDashboard"

export default function OverviewPage() {
  return (
    <GuardedOpsShell>
      <FounderDashboard />
    </GuardedOpsShell>
  )
}
