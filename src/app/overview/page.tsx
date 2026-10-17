import GuardedOpsShell from "@/components/layout/GuardedOpsShell"
import FounderDashboard from "@/features/overview/components/FounderDashboard"

export default function OverviewPage() {
  return (
    <GuardedOpsShell>
      <FounderDashboard />
    </GuardedOpsShell>
  )
}
