"use client"

import { useParams } from "next/navigation"
import GuardedOpsShell from "@/components/layout/GuardedOpsShell"
import BuildingLinkReview from "@/features/geo/BuildingLinkReview"

export default function BuildingLinkPage() {
  const { listingId } = useParams<{ listingId: string }>()
  return <GuardedOpsShell><BuildingLinkReview key={listingId} listingId={listingId} /></GuardedOpsShell>
}
