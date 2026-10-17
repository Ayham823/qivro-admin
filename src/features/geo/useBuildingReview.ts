"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ApiRequestError, getBuildingProjects, getBuildingReview, getProjectBuildings,
  saveBuildingReview, withdrawBuildingLink,
  type BuildingChoice, type BuildingReviewState, type ProjectChoice, type ReviewInput,
} from "@/lib/api"
import { getToken } from "@/lib/auth"

export function useBuildingReview(listingId: string) {
  const [data, setData] = useState<BuildingReviewState | null>(null)
  const [projects, setProjects] = useState<ProjectChoice[]>([])
  const [buildings, setBuildings] = useState<BuildingChoice[]>([])
  const [placeId, setPlaceId] = useState("")
  const [buildingId, setBuildingId] = useState("")
  const [note, setNote] = useState("")
  const [published, setPublished] = useState(false)
  const [consent, setConsent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState("")
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [stale, setStale] = useState(true)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setStale(true)
    setError("")
    try {
      const token = getToken()!
      const [review, catalog] = await Promise.all([getBuildingReview(listingId, token, signal), getBuildingProjects(token, signal)])
      if (signal?.aborted) return
      setData(review)
      setProjects(catalog.places.filter((place) => place.kind === "project"))
      setPlaceId(review.link?.placeId ?? catalog.places.find((place) => place.kind === "project")?.id ?? "")
      setBuildingId(review.link?.buildingId ?? "")
      setPublished(review.link?.published ?? false)
      setConsent(false)
      setVerified(false)
      setNote("")
      setStale(false)
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof ApiRequestError && err.status === 404
        ? "Building review is unavailable. Check the feature flag and listing ID."
        : "Could not load the latest review. Reload before making changes.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    const controller = new AbortController()
    setBuildings([])
    setCatalogError("")
    if (!placeId) { setCatalogLoading(false); return }
    setCatalogLoading(true)
    getProjectBuildings(placeId, getToken()!, controller.signal)
      .then((catalog) => { if (!controller.signal.aborted) setBuildings(catalog.features) })
      .catch(() => { if (!controller.signal.aborted) setCatalogError("Building sources could not be loaded.") })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [placeId, catalogRevision])

  const mutate = async (withdraw: boolean) => {
    if (!data || stale || busy || loading || note.trim().length < 10) return
    if (!withdraw && (!verified || !buildings.some((item) => item.id === buildingId) || (published && !consent))) return
    if (!window.confirm(withdraw ? "Withdraw this listing's public building link?" : published
      ? "Publish this exact building association? Confirm the owner has authorized this disclosure."
      : "Save this reviewed association privately?")) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const body: ReviewInput = { expectedVersion: data.link?.version ?? 0, placeId, buildingId, note: note.trim(), published, publicationConsentConfirmed: consent }
      if (withdraw) await withdrawBuildingLink(listingId, getToken()!, body)
      else await saveBuildingReview(listingId, getToken()!, body)
      setMessage(withdraw ? "Publication withdrawn." : "Review saved.")
      await reload()
    } catch (err) {
      setStale(true)
      setError(err instanceof ApiRequestError && err.status === 409
        ? "Another review changed this listing. Reload the latest state; your change was not saved."
        : "The save could not be confirmed. Reload the latest state before retrying.")
    } finally { setBusy(false) }
  }

  return { data, projects, buildings, placeId, buildingId, note, published, consent, verified, loading, catalogLoading, catalogError, error, message, stale, busy,
    setNote, setPublished: (value: boolean) => { setPublished(value); setConsent(false) }, setConsent, setVerified,
    selectProject: (id: string) => { setPlaceId(id); setBuildingId(""); setVerified(false); setConsent(false) },
    selectBuilding: (id: string) => { setBuildingId(id); setVerified(false); setConsent(false) },
    retryCatalog: () => setCatalogRevision((value) => value + 1), reload, mutate }
}
