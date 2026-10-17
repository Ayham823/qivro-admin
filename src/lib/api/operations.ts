import { apiRequest } from "./client"

import type {
  Paginated,
  OpsMetricsDashboard,
  TranslationLocale,
  OpsListingTranslation,
  OpsListingTranslationBundle,
  OpsMissingTranslation,
  OpsTranslationAudit,
  OpsAiFeedback,
  OpsAiReviewItem,
  OpsExportDataset,
  OpsSearchSynonym,
  OpsSearchOverride,
  OpsSearchQuality,
  OpsRankingLab,
  OpsRankingFeedbackItem,
  OpsRankingFeedback,
  OpsExperimentsDashboard,
  OpsAiEvaluation,
  OpsToursDashboard,
} from "./types"

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

export function logout(token: string) {
  return apiRequest<{ loggedOut: boolean }>("/auth/logout", {
    method: "POST",
    token,
  })
}

export function getMetrics(token: string, params = new URLSearchParams()) {
  const query = params.toString()
  return apiRequest<OpsMetricsDashboard>(
    `/admin/metrics${query ? `?${query}` : ""}`,
    { token }
  )
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
