import { apiRequest } from "./client"

export const trustRevocationReasons = [
  "COMPROMISED_CONTACT",
  "SUBJECT_REQUEST",
  "INVALID_EVIDENCE",
  "ADMIN_REVIEW",
] as const

export type TrustRevocationReason = (typeof trustRevocationReasons)[number]
export type TrustEvidenceAuditMetadata = {
  action: "RECORDED" | "REVOKED"
  reasonCode: TrustRevocationReason | null
  version: number
  createdAt: string
  actorId: string | null
}
export type TrustEvidenceMetadata = {
  id: string
  kind: "EMAIL"
  source: "QIVRO_EMAIL_CHALLENGE"
  status: "CONFIRMED" | "REVOKED"
  verifiedAt: string
  expiresAt: string | null
  revokedAt: string | null
  version: number
  createdAt: string
  audit: TrustEvidenceAuditMetadata[]
}
export type TrustEvidencePage = {
  data: TrustEvidenceMetadata[]
  nextCursor: string | null
}
export type TrustEvidenceRevocation = {
  id: string
  status: "REVOKED"
  version: number
  revokedAt: string
}

export class TrustEvidenceSchemaError extends Error {
  constructor() {
    super("Trust evidence metadata could not be validated. Reload before taking action.")
    this.name = "TrustEvidenceSchemaError"
  }
}

export function isTrustEvidenceUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TrustEvidenceSchemaError()
  return value as Record<string, unknown>
}

function uuid(value: unknown): string {
  if (!isTrustEvidenceUuid(value)) throw new TrustEvidenceSchemaError()
  return value
}

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TrustEvidenceSchemaError()
  }
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new TrustEvidenceSchemaError()
  return value
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : date(value)
}

function version(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2147483647) throw new TrustEvidenceSchemaError()
  return value
}

function reason(value: unknown): TrustRevocationReason {
  if (!trustRevocationReasons.includes(value as TrustRevocationReason)) throw new TrustEvidenceSchemaError()
  return value as TrustRevocationReason
}

function auditMetadata(value: unknown): TrustEvidenceAuditMetadata {
  const item = record(value)
  if (item.action !== "RECORDED" && item.action !== "REVOKED") throw new TrustEvidenceSchemaError()
  const reasonCode = item.reasonCode === null ? null : reason(item.reasonCode)
  if ((item.action === "RECORDED" && reasonCode !== null) || (item.action === "REVOKED" && reasonCode === null)) throw new TrustEvidenceSchemaError()
  return {
    action: item.action,
    reasonCode,
    version: version(item.version),
    createdAt: date(item.createdAt),
    actorId: item.actorId === null ? null : uuid(item.actorId),
  }
}

function evidenceMetadata(value: unknown): TrustEvidenceMetadata {
  const item = record(value)
  if (item.kind !== "EMAIL" || item.source !== "QIVRO_EMAIL_CHALLENGE" || (item.status !== "CONFIRMED" && item.status !== "REVOKED") || !Array.isArray(item.audit)) {
    throw new TrustEvidenceSchemaError()
  }
  const revokedAt = nullableDate(item.revokedAt)
  if ((item.status === "CONFIRMED" && revokedAt !== null) || (item.status === "REVOKED" && revokedAt === null)) throw new TrustEvidenceSchemaError()
  const currentVersion = version(item.version)
  const audit = item.audit.map(auditMetadata)
  if (audit.some((entry, index) => entry.version > currentVersion || (index > 0 && entry.version <= audit[index - 1].version))) throw new TrustEvidenceSchemaError()
  const latest = audit.at(-1)
  if (!latest || latest.version !== currentVersion || latest.action !== (item.status === "CONFIRMED" ? "RECORDED" : "REVOKED")) throw new TrustEvidenceSchemaError()
  // Allowlist metadata; never retain contact bindings, challenges, or audit snapshots.
  return {
    id: uuid(item.id), kind: item.kind, source: item.source, status: item.status,
    verifiedAt: date(item.verifiedAt), expiresAt: nullableDate(item.expiresAt), revokedAt,
    version: currentVersion, createdAt: date(item.createdAt), audit,
  }
}

export async function getTrustEvidence(
  userId: string,
  token: string,
  options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
): Promise<TrustEvidencePage> {
  const limit = options.limit ?? 20
  if (!isTrustEvidenceUuid(userId) || !Number.isInteger(limit) || limit < 1 || limit > 50 || (options.cursor !== undefined && !isTrustEvidenceUuid(options.cursor))) {
    throw new Error("A user UUID and valid evidence page are required.")
  }
  const query = new URLSearchParams({ limit: String(limit) })
  if (options.cursor) query.set("cursor", options.cursor)
  const payload = record(await apiRequest<unknown>(`/admin/trust/v1/users/${userId}/evidence?${query}`, { token, signal: options.signal }))
  if (!Array.isArray(payload.data) || payload.data.length > limit) throw new TrustEvidenceSchemaError()
  const data = payload.data.map(evidenceMetadata)
  const nextCursor = payload.nextCursor === null ? null : uuid(payload.nextCursor)
  if (new Set(data.map((entry) => entry.id)).size !== data.length || (nextCursor !== null && (nextCursor !== data.at(-1)?.id || nextCursor === options.cursor))) {
    throw new TrustEvidenceSchemaError()
  }
  return { data, nextCursor }
}

export async function revokeTrustEvidence(
  evidenceId: string,
  token: string,
  input: { expectedVersion: number; reasonCode: TrustRevocationReason },
): Promise<TrustEvidenceRevocation> {
  if (!isTrustEvidenceUuid(evidenceId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || input.expectedVersion > 2147483646 || !trustRevocationReasons.includes(input.reasonCode)) {
    throw new Error("An evidence UUID, current version, and revocation reason are required.")
  }
  const payload = record(await apiRequest<unknown>(`/admin/trust/v1/evidence/${evidenceId}/revoke`, {
    token, method: "POST", body: { expectedVersion: input.expectedVersion, reasonCode: input.reasonCode },
  }))
  if (payload.id !== evidenceId || payload.status !== "REVOKED" || payload.version !== input.expectedVersion + 1) throw new TrustEvidenceSchemaError()
  return { id: uuid(payload.id), status: payload.status, version: version(payload.version), revokedAt: date(payload.revokedAt) }
}
