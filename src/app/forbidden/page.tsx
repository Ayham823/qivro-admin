"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, LogOut, ShieldX } from "lucide-react"
import { clearDeniedAccess, getDeniedAccess, removeToken, type DeniedAccessDetails } from "@/lib/auth"

export default function ForbiddenPage() {
  const [details, setDetails] = useState<DeniedAccessDetails | null>(null)
  const publicSite = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010"

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDetails(getDeniedAccess()))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const useAnotherAccount = () => {
    removeToken()
    clearDeniedAccess()
    window.location.href = "/login"
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ops-bg)] p-6">
      <section className="ops-card w-full max-w-xl p-8 sm:p-10">
        <div className="grid size-14 place-items-center rounded-lg bg-red-50 text-[var(--ops-danger)]"><ShieldX size={28} /></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-danger)]">Access blocked</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">This area is for Qivro admins</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--ops-muted)]">Your account is valid, but it does not have the ADMIN role required for this operations dashboard.</p>

        {details ? <div className="mt-6 rounded-lg border border-[var(--ops-border)] bg-white/60 p-4 text-sm"><p className="font-bold">Signed in as</p><p className="mt-1 text-[var(--ops-muted)]">{details.email}</p><p className="mt-2 text-xs font-black uppercase tracking-wide text-[var(--ops-danger)]">Current role: {details.role}</p></div> : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={useAnotherAccount} className="ops-button inline-flex items-center justify-center gap-2"><LogOut size={17} /> Use another account</button>
          <Link href={publicSite} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ops-border)] px-4 py-3 text-sm font-black"><ArrowLeft size={17} /> Return to Qivro</Link>
        </div>
        <p className="mt-6 text-xs leading-5 text-[var(--ops-muted)]">If you should have access, ask an administrator to update your account role. Signing in again will not change permissions.</p>
      </section>
    </main>
  )
}
