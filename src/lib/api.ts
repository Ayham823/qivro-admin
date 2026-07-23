import { removeToken } from "./auth"

// The admin app has a deliberately separate API client because its authorization
// redirects and response contracts differ from the public product. Never expose
// these operations through public UI helpers.
const SERVER_API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001/api"
const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_BROWSER_API_URL?.trim() || "http://localhost:3001/api"

function getApiUrl() {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL
}

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  meta?: unknown
  error?: {
    message?: string
    code?: string
    details?: unknown
  }
  [key: string]: unknown
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  token?: string | null
  body?: unknown
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export type Paginated<T> = {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers()

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`)
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message ?? `Request failed: ${response.status}`

    if (typeof window !== "undefined" && response.status === 401) {
      removeToken()
      window.location.href = "/login?reason=session-expired"
    }

    if (typeof window !== "undefined" && response.status === 403) {
      window.location.href = "/forbidden"
    }

    throw new ApiRequestError(message, response.status)
  }

  if (payload && Array.isArray(payload.data) && payload.meta) {
    const { data, meta, success: _success, error: _error, ...rest } = payload

    return {
      data,
      meta,
      ...rest,
    } as T
  }

  return payload?.data as T
}

export type OpsOverview = {
  meta: { generatedAt: string; timezone: string }
  executive: {
    totalUsers: number
    totalListings: number
    listingStatuses: Array<{ value: string; count: number }>
    totalViews: number
    totalFavorites: number
    totalLeads: number
    conversionRate: number
    savedSearches: number
    notifications: number
    unreadNotifications: number
    paymentsTotal: number
    paidPayments: number
  }
  plans: Array<{ plan: string; users: number }>
  eventPipeline: {
    posthogForwarding: string
    topEvents: Array<{ type: string; count: number }>
  }
  ai: OpsHealthBlock
}

export type OpsMetricsDashboard = {
  meta: { generatedAt: string; timezone: string; note?: string }
  overview: {
    activeUsersOrSessions: number
    totalEvents: number
    searches: number
    views: number
    favorites: number
    leads: number
    chats: number
    messages: number
    ctr: number
    saveRate: number
    leadRate: number
    searchToLeadRate: number
  }
  funnel: Array<{
    step: string
    count: number
    rateFromPrevious: number
    rateFromVisit: number
  }>
  surfaces: {
    explore: OpsSurfaceMetrics
    listings: OpsSurfaceMetrics
    searchUsageRate: number
    sources: Array<{ value: string; count: number }>
  }
  ai: {
    search: {
      accepted: number
      rejected: number
      aiSearches: number
      nonAiSearches: number
      aiCtr: number
      nonAiCtr: number
      aiCtrLift: number
      acceptanceRate: number
    }
    ranking: {
      experimentKey: string
      variants: Array<{
        variant: string
        exposures: number
        views: number
        leads: number
        ctr: number
        conversion: number
      }>
    }
  }
  trends: Array<{
    date: string
    searches: number
    views: number
    favorites: number
    leads: number
    chats: number
    messages: number
  }>
}

export type OpsSurfaceMetrics = {
  usersOrSessions: number
  usageRate: number
  views: number
  favorites: number
  leads: number
  saveRate: number
  leadRate: number
}

export type OpsHealthBlock = {
  status: string
  url?: string
  response?: unknown
  latencyMs?: number
  message?: string
}

export type OpsListing = {
  id: string
  title: string
  status: string
  city: string
  neighborhood?: string | null
  price: number
  type: string
  mode: string
  featuredUntil?: string | null
  boostedUntil?: string | null
  owner: {
    id: string
    name: string | null
    email: string
    role: string
    plan: string
    isVerified: boolean
  }
  metrics: {
    views: number
    favorites: number
    leads: number
    reports: number
  }
  intelligence: {
    qualityScore: number
    duplicateRisk: string
    fraudFlags: string[]
  }
}

export type TranslationLocale = "en" | "ar" | "he"
export type TranslationStatus =
  | "PENDING"
  | "GENERATED"
  | "REVIEWED"
  | "PUBLISHED"
  | "REJECTED"
  | "STALE"

export type OpsTranslationListing = {
  id: string
  sourceLocale: string
  originalTitle: string
  originalDescription: string
  city: string
  neighborhood?: string | null
  type: string
  mode: string
  price: number
  rooms: number
  bathrooms: number
  area: number
}

export type OpsListingTranslation = {
  id: string
  listingId: string
  locale: TranslationLocale
  title: string
  description: string
  sourceHash: string
  status: TranslationStatus
  sourceType: "HUMAN" | "AI" | "OWNER" | "ADMIN" | "IMPORTED"
  provider?: string | null
  model?: string | null
  version: number
  reviewedAt?: string | null
  reviewedById?: string | null
  reviewedBy?: {
    id: string
    name?: string | null
    email: string
  } | null
  createdAt: string
  updatedAt: string
  stale: boolean
  listing: OpsTranslationListing
}

export type OpsListingTranslationBundle = {
  id: string
  sourceLocale: string
  originalTitle: string
  originalDescription: string
  translations: Array<Omit<OpsListingTranslation, "listing">>
}

export type OpsMissingTranslation = {
  id: string
  sourceLocale: string
  originalTitle: string
  originalDescription: string
  city: string
  neighborhood?: string | null
  status: string
  updatedAt: string
  missingLocale: TranslationLocale
}

export type OpsTranslationAudit = {
  id: string
  listingTranslationId: string
  actorId: string
  action: string
  before?: unknown
  after?: unknown
  createdAt: string
  actor: {
    id: string
    name?: string | null
    email: string
  }
}

export type OpsUser = {
  id: string
  name: string | null
  email: string
  phone?: string | null
  role: string
  plan: string
  planExpiresAt?: string | null
  isVerified: boolean
  createdAt: string
  metrics: {
    listings: number
    favorites: number
    payments: number
    notifications: number
  }
}

export type OpsLead = {
  id: string
  status: string
  source?: string | null
  name: string
  phone: string
  message: string
  createdAt: string
  listing: {
    id: string
    title: string
    city: string
    price: number
  }
  owner: { id: string; name: string | null; email: string }
  sender?: { id: string; name: string | null; email: string } | null
}

export type OpsAiMetrics = {
  meta: { generatedAt: string; timezone: string }
  health: OpsHealthBlock
  usage: {
    totalEvents: number
    accepted: number
    rejected: number
  }
  feedback: {
    pending: number
    reviewed: number
    correct: number
    incorrect: number
    useful: number
    notUseful: number
    approved: number
    rejected: number
  }
  requests: {
    total: number
    success: number
    failed: number
    fallback: number
    cacheHits: number
    latency: {
      p50: number
      p90: number
      p95: number
    }
    byEndpoint: Array<{
      value: string
      count: number
      failed: number
      avgLatencyMs: number
    }>
  }
  sources: Array<{ value: string; count: number }>
  actions: Array<{ value: string; count: number }>
  endpoints: string[]
  recentEvents: Array<{
    id: string
    type: string
    entityType?: string | null
    entityId?: string | null
    metadata?: unknown
    createdAt: string
  }>
  recentRequests: Array<{
    id: string
    endpoint: string
    provider?: string | null
    model?: string | null
    success: boolean
    fallbackUsed: boolean
    cacheHit: boolean
    latencyMs: number
    inputJson?: unknown
    outputJson?: unknown
    errorMessage?: string | null
    createdAt: string
    feedback: OpsAiFeedback | null
  }>
}

export type OpsAiFeedback = {
  id: string
  actorUserId?: string | null
  correctness?: "CORRECT" | "INCORRECT" | null
  usefulness?: "USEFUL" | "NOT_USEFUL" | null
  approval?: "APPROVE" | "REJECT" | null
  reviewerNote?: string | null
  expectedOutputJson?: unknown
  createdAt: string
  updatedAt: string
}

export type OpsAiReviewItem = {
  id: string
  endpoint: string
  provider?: string | null
  model?: string | null
  success: boolean
  fallbackUsed: boolean
  cacheHit: boolean
  latencyMs: number
  inputJson?: unknown
  outputJson?: unknown
  errorMessage?: string | null
  createdAt: string
  feedback: OpsAiFeedback | null
}

export type OpsSystemHealth = {
  meta: { generatedAt: string; timezone: string }
  backend: { status: string; environment?: string }
  database: OpsHealthBlock
  redis: OpsHealthBlock
  ai: OpsHealthBlock
  posthog: { host?: string; configured: boolean }
}

export function login(email: string, password: string) {
  return apiRequest<{
    access_token: string
    user: { id: string; email: string; role: string }
  }>("/auth/login", {
    method: "POST",
    body: { email, password },
  })
}

export function getMe(token: string) {
  return apiRequest<{
    id: string
    email: string
    role: string
    name?: string | null
  }>("/auth/me", { token })
}

export function getMetrics(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsMetricsDashboard>(
    `/admin/metrics${query ? `?${query}` : ""}`,
    { token }
  )
}

export type OpsAuditLog = {
  id: string
  actorUserId?: string | null
  targetType: string
  targetId: string
  action: string
  beforeJson?: unknown
  afterJson?: unknown
  metadataJson?: unknown
  createdAt: string
}

export type OpsModerationReport = {
  id: string
  listingId: string
  userId?: string | null
  sessionId?: string | null
  reason: string
  message?: string | null
  reviewStatus: string
  adminNotes?: string | null
  reviewedAt?: string | null
  reviewedById?: string | null
  createdAt: string
  listing: {
    id: string
    title: string
    city: string
    status: string
    price: number
    createdBy: {
      id: string
      name: string | null
      email: string
      isVerified: boolean
    }
  }
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

export type OpsExportDataset = {
  dataset: string
  format: "json" | "csv"
  generatedAt: string
  rows: Array<Record<string, unknown>>
  csv?: string
}

export type OpsSearchSynonym = {
  id: string
  term: string
  synonym: string
  createdAt: string
  updatedAt: string
}

export type OpsSearchOverride = {
  id: string
  query: string
  normalizedQuery: string
  rewrittenQuery?: string | null
  filtersJson: Record<string, unknown>
  note?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type OpsSearchQuality = {
  meta: { generatedAt: string; timezone: string }
  overview: {
    totalSearches: number
    noResults: number
    lowCtr: number
    failedAiParses: number
  }
  topQueries: Array<{ query: string; count: number }>
  noResultsQueries: Array<{ query: string; count: number; latestAt: string }>
  lowCtrQueries: Array<{ query: string; searches: number; clicks: number; ctr: number }>
  failedAiParses: Array<{
    id: string
    endpoint: string
    inputJson?: unknown
    outputJson?: unknown
    success: boolean
    fallbackUsed: boolean
    errorMessage?: string | null
    createdAt: string
  }>
  rewriteSuggestions: Array<{
    query: string
    suggestion: string
    reason: string
    filtersJson?: unknown
  }>
  synonyms: OpsSearchSynonym[]
  overrides: OpsSearchOverride[]
}

export type OpsRankingLab = {
  meta: { generatedAt: string; timezone: string }
  engine: {
    version: string
    searchWeights: { rules: number; ai: number }
    recommendationWeights: { rules: number; ai: number }
  }
  activeStrategy: "DEFAULT" | "POPULARITY" | "BEHAVIOR" | "AI"
  sampledViewers: number
  strategies: Array<{
    strategy: "DEFAULT" | "POPULARITY" | "BEHAVIOR" | "AI"
    isActive: boolean
    metrics: {
      ctr: number
      saveRate: number
      leadRate: number
    }
    topListings: Array<{
      id: string
      title: string
      city: string
      views: number
      favorites: number
      leads: number
      appearances: number
      avgScore: number
    }>
  }>
}

export type OpsRankingFeedbackItem = {
  id: string
  listingId: string
  listingTitle: string
  city: string
  price: number
  rank: number
  score: number
  baseScore: number
  aiScore: number
  reason?: string | null
  createdAt: string
  decision: {
    id: string
    objective: string
    queryText?: string | null
    strategy?: string | null
    filtersJson?: unknown
    viewerJson?: unknown
    engineVersion: string
    weightsJson?: unknown
    createdAt: string
  }
  feedback: {
    id: string
    actorUserId?: string | null
    quality?: "GOOD" | "BAD" | null
    relevance?: "RELEVANT" | "NOT_RELEVANT" | null
    reviewerNote?: string | null
    createdAt: string
    updatedAt: string
  } | null
}

export type OpsRankingFeedback = Paginated<OpsRankingFeedbackItem> & {
  summary: {
    reviewed: number
    pending: number
    good: number
    bad: number
    relevant: number
    notRelevant: number
  }
}

export type OpsExperimentsDashboard = {
  meta: { generatedAt: string; timezone: string }
  overview: {
    activeExperiments: number
    exposures: number
  }
  experiments: Array<{
    key: string
    name: string
    description?: string | null
    status: string
    primaryMetric: string
    split: {
      control: string
      treatment: string
      treatmentPercentage: number
    }
    winner: string
    variants: Array<{
      variant: string
      exposures: number
      ctr: number
      leads: number
      conversion: number
      retention: number
    }>
  }>
}

export type OpsAiEvaluation = {
  meta: { generatedAt: string; timezone: string }
  summary: Array<{
    endpoint: string
    reviewed: number
    accuracy: number
    successRate: number
    rejectionRate: number
    usefulnessScore: number
  }>
  totals: {
    reviewed: number
    failureCases: number
  }
  failureCases: Array<{
    id: string
    requestLogId: string
    endpoint: string
    provider?: string | null
    model?: string | null
    latencyMs: number
    fallbackUsed: boolean
    success: boolean
    input?: unknown
    expected?: unknown
    prediction?: unknown
    correct: boolean | null
    useful: boolean | null
    approved: boolean | null
    reviewerNote?: string | null
    errorMessage?: string | null
    createdAt: string
  }>
  trends: Array<{
    date: string
    endpoint: string
    reviewed: number
    correct: number
    rejected: number
    useful: number
  }>
}

export type OpsTourStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PROCESSING"
  | "OPTIMIZING"
  | "READY"
  | "FAILED"
  | "DELETED"

export type OpsTourJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"

export type OpsTour = {
  id: string
  listingId: string
  ownerId: string
  status: OpsTourStatus
  inputType: "VIDEO" | "IMAGES" | "LIDAR"
  inputUrl?: string | null
  outputUrl?: string | null
  thumbnailUrl?: string | null
  progress: number
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  listing: {
    id: string
    title: string
    city: string
    price: number
    status: string
  }
  owner: {
    id: string
    name: string | null
    email: string
    role: string
    plan: string
  }
  latestJob: {
    id: string
    status: OpsTourJobStatus
    currentStep?: string | null
    logsJson?: unknown
    startedAt?: string | null
    finishedAt?: string | null
    createdAt: string
    updatedAt: string
  } | null
  jobsCount: number
}

export type OpsTourJobMonitor = {
  id: string
  status: OpsTourJobStatus
  currentStep?: string | null
  logsJson?: unknown
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
  tour: {
    id: string
    status: OpsTourStatus
    progress: number
    errorMessage?: string | null
    inputUrl?: string | null
    outputUrl?: string | null
    thumbnailUrl?: string | null
    listing: {
      id: string
      title: string
      city: string
      status: string
    }
    owner: {
      id: string
      name: string | null
      email: string
    }
  }
}

export type OpsToursDashboard = Paginated<OpsTour> & {
  summary: {
    total: number
    filtered: number
    readyRate: number
    readyWithOutput: number
    readyMissingOutput: number
    failedTours: number
    queuedJobs: number
    completedJobs: number
    failedJobs: number
    processingJobs: number
    staleJobs: number
    averageCompletionSeconds: number | null
    byStatus: Array<{ value: string; count: number }>
    jobsByStatus: Array<{ value: string; count: number }>
  }
  recentJobs: OpsTourJobMonitor[]
  recentFailures: OpsTourJobMonitor[]
}

export function getTours(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsToursDashboard>(
    `/admin/tours${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getAiReviewQueue(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<Paginated<OpsAiReviewItem>>(
    `/admin/ai/review-queue${query ? `?${query}` : ""}`,
    { token }
  )
}

export function updateAiFeedback(
  token: string,
  id: string,
  body: {
    correctness?: "CORRECT" | "INCORRECT"
    usefulness?: "USEFUL" | "NOT_USEFUL"
    approval?: "APPROVE" | "REJECT"
    reviewerNote?: string
    expectedOutputJson?: Record<string, unknown>
  }
) {
  return apiRequest<OpsAiFeedback>(`/admin/ai/review-queue/${id}/feedback`, {
    method: "PATCH",
    token,
    body,
  })
}

export function getAiEvaluation(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsAiEvaluation>(
    `/admin/ai/evaluation${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getAiEvaluationDataset(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<OpsExportDataset>(
    `/admin/ai/evaluation/dataset${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getSearchQuality(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsSearchQuality>(
    `/admin/search-quality${query ? `?${query}` : ""}`,
    { token }
  )
}

export function createSearchSynonym(
  token: string,
  body: { term: string; synonym: string }
) {
  return apiRequest<OpsSearchSynonym>("/admin/search-quality/synonyms", {
    method: "POST",
    token,
    body,
  })
}

export function deleteSearchSynonym(token: string, id: string) {
  return apiRequest<OpsSearchSynonym>(`/admin/search-quality/synonyms/${id}`, {
    method: "DELETE",
    token,
  })
}

export function createSearchOverride(
  token: string,
  body: {
    query: string
    rewrittenQuery?: string
    filtersJson: Record<string, unknown>
    note?: string
    active?: boolean
  }
) {
  return apiRequest<OpsSearchOverride>("/admin/search-quality/overrides", {
    method: "POST",
    token,
    body,
  })
}

export function deleteSearchOverride(token: string, id: string) {
  return apiRequest<OpsSearchOverride>(`/admin/search-quality/overrides/${id}`, {
    method: "DELETE",
    token,
  })
}

export function getRankingLab(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsRankingLab>(
    `/admin/ranking-lab${query ? `?${query}` : ""}`,
    { token }
  )
}

export function updateRecommendationStrategy(
  token: string,
  strategy: "DEFAULT" | "POPULARITY" | "BEHAVIOR" | "AI"
) {
  return apiRequest<{ strategy: string; updated: boolean }>(
    "/admin/ranking-lab/strategy",
    {
      method: "PATCH",
      token,
      body: { strategy },
    }
  )
}

export function getRankingFeedback(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<OpsRankingFeedback>(
    `/admin/ranking-feedback${query ? `?${query}` : ""}`,
    { token }
  )
}

export function updateRankingFeedback(
  token: string,
  itemId: string,
  body: {
    quality?: "GOOD" | "BAD"
    relevance?: "RELEVANT" | "NOT_RELEVANT"
    reviewerNote?: string
  }
) {
  return apiRequest<OpsRankingFeedbackItem["feedback"]>(
    `/admin/ranking-feedback/items/${itemId}`,
    {
      method: "PATCH",
      token,
      body,
    }
  )
}

export function getExperiments(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsExperimentsDashboard>(
    `/admin/experiments${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getTranslations(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<Paginated<OpsListingTranslation>>(
    `/admin/translations${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getMissingTranslations(
  token: string,
  params = new URLSearchParams()
) {
  const query = params.toString()
  return apiRequest<Paginated<OpsMissingTranslation>>(
    `/admin/translations/missing${query ? `?${query}` : ""}`,
    { token }
  )
}

export function getListingTranslations(token: string, listingId: string) {
  return apiRequest<OpsListingTranslationBundle>(
    `/admin/listings/${listingId}/translations`,
    { token }
  )
}

export function getTranslationAudit(token: string, translationId: string) {
  return apiRequest<OpsTranslationAudit[]>(
    `/admin/translations/${translationId}/audit`,
    { token }
  )
}

export function updateTranslation(
  token: string,
  translationId: string,
  body: { title: string; description: string }
) {
  return apiRequest<OpsListingTranslation>(
    `/admin/translations/${translationId}`,
    { method: "PATCH", token, body }
  )
}

export function runTranslationAction(
  token: string,
  translationId: string,
  action: "approve" | "mark-reviewed" | "reject" | "publish" | "regenerate",
  body?: { reason?: string }
) {
  return apiRequest<OpsListingTranslation>(
    `/admin/translations/${translationId}/${action}`,
    { method: "POST", token, body }
  )
}

export function generateMissingTranslation(
  token: string,
  listingId: string,
  targetLocale: TranslationLocale
) {
  return apiRequest<OpsListingTranslation>(
    `/admin/listings/${listingId}/translations/regenerate`,
    { method: "POST", token, body: { targetLocale } }
  )
}
