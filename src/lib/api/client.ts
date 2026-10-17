import { isCookieSessionToken, removeToken } from "../auth"

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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  token?: string | null
  body?: unknown
  signal?: AbortSignal
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers()

  if (options.token && !isCookieSessionToken(options.token)) {
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
    credentials: "include",
    signal: options.signal,
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
    const { data, meta } = payload
    const rest = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) => !["data", "meta", "success", "error"].includes(key)
      )
    )

    return {
      data,
      meta,
      ...rest,
    } as T
  }

  return payload?.data as T
}
