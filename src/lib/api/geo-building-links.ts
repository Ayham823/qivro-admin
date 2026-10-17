import { apiRequest } from "./client"

export type BuildingLink = {
  listingId: string
  placeId: string
  buildingId: string
  sourceVersion: number
  published: boolean
  version: number
  updatedAt?: string
}
export type BuildingReview = BuildingLink & {
  action: "REVIEW" | "WITHDRAW"
  note: string
  consentConfirmed: boolean
  createdAt: string
}
export type BuildingReviewState = {
  listing: { id: string; title: string; city: string; status: string; availabilityStatus: string }
  link: BuildingLink | null
  reviews: BuildingReview[]
  historyLimit: number
}
export type BuildingChoice = {
  id: string
  properties: { name: string; sourceUrl: string; sourceVersion: number; sourceModifiedAt: string; street: string | null; houseNumber: string | null }
}
export type ProjectChoice = { id: string; name: string; kind: "project" | "city" }
export type ReviewInput = {
  expectedVersion: number
  note: string
  placeId: string
  buildingId: string
  published: boolean
  publicationConsentConfirmed: boolean
}
const path = (id: string) => `/admin/geo/v1/listings/${encodeURIComponent(id)}/building`

export const getBuildingReview = (id: string, token: string, signal?: AbortSignal) =>
  apiRequest<BuildingReviewState>(path(id), { token, signal })
export const getBuildingProjects = (token: string, signal?: AbortSignal) =>
  apiRequest<{ places: ProjectChoice[] }>("/geo/v1/places", { token, signal })
export const getProjectBuildings = (id: string, token: string, signal?: AbortSignal) =>
  apiRequest<{ features: BuildingChoice[] }>(`/geo/v1/places/${encodeURIComponent(id)}/buildings`, { token, signal })
export const saveBuildingReview = (id: string, token: string, body: ReviewInput) =>
  apiRequest<BuildingLink>(path(id), { token, method: "PUT", body })
export const withdrawBuildingLink = (id: string, token: string, body: Pick<ReviewInput, "expectedVersion" | "note">) =>
  apiRequest<BuildingLink>(`${path(id)}/withdraw`, { token, method: "POST", body: { expectedVersion: body.expectedVersion, note: body.note } })
