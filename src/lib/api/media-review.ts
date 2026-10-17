import { apiRequest } from "./client"

export type OpsAiMediaReviewDecision =
  | "APPROVE"
  | "REJECT"
  | "RETRY"
  | "RETRY_OTHER_PROVIDER"
  | "MARK_MISLEADING"
  | "PUBLISH"

export type OpsAiMediaReviewRecord = {
  id: string
  jobId: string
  decision: OpsAiMediaReviewDecision
  fromStatus: string
  toStatus: string
  reasonCode?: string | null
  note?: string | null
  providerPreference?: string | null
  retryJobId?: string | null
  createdAt: string
  actor?: { id: string; name?: string | null; email: string } | null
  retryJob?: { id: string; status: string; createdAt: string } | null
}

export type OpsAiMediaReviewItem = {
  id: string
  status: string
  mediaType?: string | null
  style?: string | null
  qualityPreset?: string | null
  listing?: {
    id: string
    title: string
    city: string
    status: string
    image?: string | null
  } | null
  owner?: {
    id: string
    name?: string | null
    email: string
    role: string
    isVerified: boolean
  } | null
  qualityScore?: number | null
  warnings: unknown[]
  provider?: string | null
  model?: string | null
  totalCostMicros: number
  outputCount: number
  latestReview?: OpsAiMediaReviewRecord | null
  canPublish: boolean
  createdAt: string
  updatedAt: string
}

export type OpsAiMediaReviewQueue = {
  data: OpsAiMediaReviewItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    status: string
    statusCounts: Record<string, number>
    availableProviders: string[]
  }
}

export type OpsAiMediaReviewDetail = OpsAiMediaReviewItem & {
  input: Record<string, unknown>
  originalMedia: Array<{
    mediaId: string
    sortOrder: number
    kind: string
    mimeType: string
    sizeBytes: number
    metadata?: unknown
    createdAt: string
    accessUrl: string
    expiresAt: string
  }>
  outputs: Array<{
    id: string
    kind: string
    version: number
    isPrimary: boolean
    artifactRef?: string | null
    mimeType?: string | null
    payload: unknown
    qualityScore?: number | null
    warnings: unknown[]
    metadata?: unknown
    previewUrl?: string | null
    renderable: boolean
    publishable: boolean
    createdAt: string
  }>
  providerUsages: Array<{
    id?: string
    provider: string
    model?: string | null
    status?: string
    latencyMs?: number
    estimatedCostMicros?: number | null
    fallbackUsed?: boolean
    errorCode?: string | null
    createdAt: string
  }>
  reviews: OpsAiMediaReviewRecord[]
  audit: {
    requestId: string
    traceId: string
    attemptCount: number
    createdAt: string
    updatedAt: string
  }
  availableProviders: string[]
  alternateProviders: string[]
}

export type OpsAiMediaReviewResult = {
  duplicate: boolean
  review: OpsAiMediaReviewRecord
  job: { id: string; status: string }
  retryJob?: { id: string; status: string; createdAt?: string } | null
}

export function getAiMediaReviewQueue(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<OpsAiMediaReviewQueue>(
    `/admin/ai/media/reviews${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getAiMediaReviewDetail(token: string, jobId: string) {
  return apiRequest<OpsAiMediaReviewDetail>(
    `/admin/ai/media/reviews/${jobId}`,
    { token }
  )
}

export function reviewAiMediaJob(
  token: string,
  jobId: string,
  body: {
    decision: OpsAiMediaReviewDecision
    idempotencyKey: string
    reasonCode?: string
    note?: string
    providerPreference?: string
  }
) {
  return apiRequest<OpsAiMediaReviewResult>(
    `/admin/ai/media/reviews/${jobId}/decisions`,
    { method: "POST", token, body }
  )
}
