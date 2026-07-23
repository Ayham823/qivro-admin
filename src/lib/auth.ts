const TOKEN_KEY = "aqx_ops_token"
const DENIED_ACCESS_KEY = "qivro:admin-denied-access"

export type DeniedAccessDetails = {
  email: string
  role: string
}

export function getToken() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  window.localStorage.removeItem(TOKEN_KEY)
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
