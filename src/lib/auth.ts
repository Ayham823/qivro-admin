const LEGACY_TOKEN_KEY = "aqx_ops_token"
const COOKIE_SESSION_MARKER = "__qivro_admin_cookie_session__"
const DENIED_ACCESS_KEY = "qivro:admin-denied-access"

export type DeniedAccessDetails = {
  email: string
  role: string
}

export function getToken() {
  if (typeof window === "undefined") {
    return null
  }

  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
  return COOKIE_SESSION_MARKER
}

export function saveToken(token: string) {
  void token
  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function removeToken() {
  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function isCookieSessionToken(token: string) {
  return token === COOKIE_SESSION_MARKER
}

export function saveDeniedAccess(details: DeniedAccessDetails) {
  window.sessionStorage.setItem(DENIED_ACCESS_KEY, JSON.stringify(details))
}

export function getDeniedAccess(): DeniedAccessDetails | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.sessionStorage.getItem(DENIED_ACCESS_KEY)
    return value ? (JSON.parse(value) as DeniedAccessDetails) : null
  } catch {
    return null
  }
}

export function clearDeniedAccess() {
  window.sessionStorage.removeItem(DENIED_ACCESS_KEY)
}
