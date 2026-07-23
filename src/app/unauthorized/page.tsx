import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="ops-card max-w-md p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-warning)]">
          Unauthorized
        </p>
        <h1 className="mt-3 text-3xl font-black">Session required</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
          Your session is missing or expired. Sign in again with an admin account.
        </p>
        <Link className="ops-button mt-5 inline-flex" href="/login">
          Login
        </Link>
      </section>
    </main>
  )
}
