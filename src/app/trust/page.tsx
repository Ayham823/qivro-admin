import GuardedOpsShell from "@/components/layout/GuardedOpsShell"
import TrustEvidenceReview from "@/features/trust/TrustEvidenceReview"

export default function TrustPage() {
  return (
    <GuardedOpsShell>
      <TrustEvidenceReview />
    </GuardedOpsShell>
  )
}
