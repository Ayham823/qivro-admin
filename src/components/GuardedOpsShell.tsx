"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import OpsShell, { type AdminUserIdentity } from "@/components/OpsShell"
import { LoadingBlock } from "@/components/StateBlock"
import { getMe } from "@/lib/api"
import { getToken, removeToken, saveDeniedAccess } from "@/lib/auth"

export default function GuardedOpsShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<AdminUserIdentity | null>(null)

  useEffect(() => {
    const token = getToken()

    if (!token) {
      router.replace("/login")
      return
    }

    getMe(token)
      .then((user) => {
        if (user.role !== "ADMIN") {
          saveDeniedAccess({ email: user.email, role: user.role })
          router.replace("/forbidden")
          return
        }

        setUser(user)
      })
      .catch(() => {
        removeToken()
        router.replace("/login?reason=session-expired")
      })
  }, [router])

  if (!user) {
    return (
      <OpsShell>
        <LoadingBlock label="Checking admin session..." />
      </OpsShell>
    )
  }

  return <OpsShell user={user}>{children}</OpsShell>
}
