"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { login } from "@/lib/api"
import { saveToken } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    try {
      setLoading(true)
      setError("")
      const result = await login(email, password)

      if (result.user.role !== "ADMIN") {
        setError("This dashboard is restricted to ADMIN users.")
        return
      }

      saveToken(result.access_token)
      router.push("/overview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="ops-card w-full max-w-md p-7">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--ops-accent)]">
          Internal only
        </p>
        <h1 className="mt-3 text-3xl font-black">Ops Login</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
          Use an ADMIN account. This app is designed for a separate internal
          subdomain such as admin.yourdomain.com.
        </p>

        <div className="mt-6 grid gap-3">
          <input
            className="ops-input"
            placeholder="Admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="ops-input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
          <button className="ops-button ops-button-primary" onClick={submit}>
            {loading ? "Checking..." : "Enter Ops Dashboard"}
          </button>
        </div>
      </section>
    </main>
  )
}
