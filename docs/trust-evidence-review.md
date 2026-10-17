# Trust Evidence Review

## Scope

`/trust` is a guarded Admin review route. Navigation and Users link to it; a
`userId` UUID query only prefills the input. Opening the route does not read
subject evidence or write anything. The operator explicitly loads a UUID.
Existing Users verification/account actions are unchanged and are not ledger
evidence creation or approval.

The backend remains authoritative for JWT, ADMIN role, active actor, active
subject, ledger availability, version conflicts, and audit persistence. A
client guard, hidden control, or metadata status is never authorization.
Email evidence is not identity, ownership, or current-contact verification.
There is no evidence creation, approval, contact lookup, free-text note, or
provider integration in this route.

## Contract

Source of truth: backend `trust-ledger.dto.ts`, `trust-admin.controller.ts`,
`trust-ledger.service.ts`, and `api-response.interceptor.ts`.

- GET `/api/admin/trust/v1/users/:UUID/evidence?limit=20&cursor=:UUID` returns
  `{ success: true, data: { data: EvidenceMetadata[], nextCursor: UUID|null } }`.
  The existing Admin transport unwraps the outer envelope. Request limits are
  1-50; the UI uses 20 and keeps only the current page plus a cursor stack.
- Metadata includes UUID, EMAIL kind, QIVRO_EMAIL_CHALLENGE source,
  CONFIRMED/REVOKED status, evidence/expiry/revocation/creation dates, version,
  and audit action/reason/version/date/actor UUID. These are ledger records,
  not a claim that the current account contact remains verified.
- POST `/api/admin/trust/v1/evidence/:UUID/revoke` sends only
  `{ expectedVersion, reasonCode }`. Version is an integer from 1 to 2147483646.
  Reasons: COMPROMISED_CONTACT, SUBJECT_REQUEST, INVALID_EVIDENCE, ADMIN_REVIEW.
  The receipt is `{ id, status: "REVOKED", version, revokedAt }`.
- Runtime validation allowlists metadata and discards private or extra fields,
  including contactBinding, challengeHash, keyVersion, contact details, and
  audit before/after snapshots. Invalid enums, dates, versions, audit state,
  envelopes, or cursors fail closed. Schema evolution requires a client update.

Subject edits abort superseded reads and clear previous metadata/confirmation.
Epoch checks prevent a late read from restoring another subject's data.
Reads, paging, and reloads do not write. Revocation needs a reason, a checked
confirmation, and a native confirmation showing UUID, version, and reason.
No optimistic state change or automatic mutation retry occurs. A successful
receipt triggers a first-page reload; only that fresh response changes the
timeline. If the receipt is accepted but refresh fails, the UI explicitly says
so and locks the stale metadata. A failed/ambiguous POST also locks actions.
Conflict 409 requires explicit reload and fresh confirmation. Status 503 means
disabled or unavailable, not an empty ledger or successful verification.
401/403 use existing transport redirects and discard the subject page.
Server error text is not echoed, avoiding accidental private detail exposure.

## Files and Exports

- `src/lib/api/trust-evidence.ts`: `trustRevocationReasons`,
  `TrustRevocationReason`, `TrustEvidenceAuditMetadata`, `TrustEvidenceMetadata`,
  `TrustEvidencePage`, `TrustEvidenceRevocation`, `TrustEvidenceSchemaError`,
  `isTrustEvidenceUuid`, `getTrustEvidence`, `revokeTrustEvidence`.
- `src/lib/api.ts`: re-exports the Trust client and retains existing exports.
- `src/app/trust/page.tsx`: default `TrustPage`.
- `src/features/trust/TrustEvidenceReview.tsx`: default `TrustEvidenceReview`.
- `src/features/trust/TrustEvidenceTimeline.tsx`: default
  `TrustEvidenceTimeline`, named `trustReasonLabels`.
- `src/config/admin-navigation.ts`: existing navigation exports unchanged;
  adds Trust Evidence to the shared navigation/command-palette source.
- `src/app/users/page.tsx`: existing default `UsersPage`; adds UUID-only link.
- `scripts/test-trust-evidence.mjs`: persistent mock-fetch Node contracts.
- `scripts/test-trust-evidence-browser.mjs`: persistent Playwright fixtures.
- `docs/trust-evidence-review.md`: this handoff.

## Verification

With the existing installed dependencies and Node 20:

```bash
node --test scripts/test-trust-evidence.mjs
```

For staged-only contracts, the caller may set `QIVRO_TYPESCRIPT_MODULE`,
`QIVRO_ADMIN_CLIENT_PATH`, and `QIVRO_ADMIN_AUTH_PATH` to existing installed
TypeScript and the isolated snapshot's transport/auth files. The runner
transpiles in memory; it never copies, installs, writes source, or calls APIs.
Fixtures cover cookie/bearer transport, abort, paging, malformed metadata,
private-field stripping, all revocation reasons, strict write payloads,
invalid receipts, authorization, disabled ledger, conflict, and no retries.

The browser runner uses an isolated loopback production preview and installed
tooling:

```bash
QIVRO_ADMIN_TEST_URL=http://127.0.0.1:PORT \
QIVRO_PLAYWRIGHT_MODULE=/absolute/installed/@playwright/test \
node scripts/test-trust-evidence-browser.mjs
```

All API requests are intercepted; unexpected APIs fail and external requests
are blocked. Synthetic UUIDs and `.invalid` admin identity are used, never real
contacts. The script does not build or start services. Desktop/mobile checks
cover confirmation cancellation, paging, conflict reload, authoritative revoke,
failed refresh, unavailable/schema locks, subject races, auth denial, privacy,
and horizontal overflow. Screenshots go to `test-results/trust-evidence/`.

Final local verification on 2026-10-11: lint without warnings, semantic
typecheck, production build, 33 mock-only contracts, and 18 grouped browser
checks passed. Browser checks cover 1440px and 390px with CSP enabled and
assert that framework scripts carry the request nonce without CSP violations.
Fixtures do not verify real evidence storage, providers, or live mutations.

The root layout awaits `connection()` before rendering. Per-request CSP nonces
cannot be attached to build-time static HTML; removing this dynamic boundary
can block hydration in production. The existing CSP policy is not weakened.

The guarded source transfer is applied locally. Original files were backed up
outside the repository. The independent root-layout fix is committed as
`6310f09`; other new and pre-existing changes remain uncommitted. No dependency,
schema, migration, secret, environment, or provider change was made. The ledger
is not activated by the UI, and real revocation remains a separate authorized
operation.
