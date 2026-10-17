import type { TrustEvidenceMetadata, TrustRevocationReason } from "@/lib/api"

export const trustReasonLabels: Record<TrustRevocationReason, string> = {
  COMPROMISED_CONTACT: "Compromised contact",
  SUBJECT_REQUEST: "Subject request",
  INVALID_EVIDENCE: "Invalid evidence",
  ADMIN_REVIEW: "Admin review",
}

function Timestamp({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{value.replace("T", " ").replace("Z", " UTC")}</time> : <>Not recorded</>
}

export default function TrustEvidenceTimeline({
  records,
  canRevoke,
  onRevoke,
}: {
  records: TrustEvidenceMetadata[]
  canRevoke: boolean
  onRevoke: (evidence: TrustEvidenceMetadata) => void
}) {
  return (
    <ol className="space-y-6" aria-label="Evidence timeline">
      {records.map((evidence) => (
        <li key={evidence.id} className="min-w-0 border-t border-[var(--ops-border)] pt-5">
          <article aria-label={`Evidence ${evidence.id}`} className="min-w-0 space-y-4 break-words">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Email evidence</h2>
                <p className="break-all font-mono text-sm text-[var(--ops-muted)]">{evidence.id}</p>
              </div>
              <span className="ops-pill">{evidence.status} / Version {evidence.version}</span>
            </div>
            <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-[var(--ops-muted)]">Source</dt><dd className="break-all">{evidence.source}</dd></div>
              <div><dt className="text-[var(--ops-muted)]">Verified at (evidence)</dt><dd><Timestamp value={evidence.verifiedAt} /></dd></div>
              <div><dt className="text-[var(--ops-muted)]">Recorded at</dt><dd><Timestamp value={evidence.createdAt} /></dd></div>
              <div><dt className="text-[var(--ops-muted)]">Expires at</dt><dd><Timestamp value={evidence.expiresAt} /></dd></div>
              <div><dt className="text-[var(--ops-muted)]">Revoked at</dt><dd><Timestamp value={evidence.revokedAt} /></dd></div>
            </dl>
            <h3 className="font-bold">Audit history</h3>
            {evidence.audit.length ? (
              <ol className="space-y-3 text-sm" aria-label={`Audit history ${evidence.id}`}>
                {evidence.audit.map((entry) => (
                  <li key={`${entry.version}-${entry.action}`} className="border-l-2 border-[var(--ops-border)] pl-3">
                    <p>{entry.action} / Version {entry.version}{entry.reasonCode ? ` / ${trustReasonLabels[entry.reasonCode]}` : ""}</p>
                    <p className="text-[var(--ops-muted)]"><Timestamp value={entry.createdAt} /></p>
                    <p className="break-all text-[var(--ops-muted)]">Actor UUID: {entry.actorId ?? "Not recorded"}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-[var(--ops-muted)]">No audit metadata returned.</p>}
            {evidence.status === "CONFIRMED" ? (
              <button type="button" className="ops-button" disabled={!canRevoke || evidence.version > 2147483646} onClick={() => onRevoke(evidence)}>
                Revoke evidence
              </button>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  )
}
