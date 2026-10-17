export function createContentSecurityPolicy({
  nonce,
  isDevelopment,
}: {
  nonce: string
  isDevelopment: boolean
}) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    "script-src-attr 'none'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${isDevelopment ? " http: ws:" : ""}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]

  if (!isDevelopment) directives.push("upgrade-insecure-requests")

  return directives.join("; ")
}
