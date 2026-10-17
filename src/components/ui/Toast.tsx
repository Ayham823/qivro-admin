"use client"

import { useState } from "react"

type ToastTone = "success" | "error" | "info"

export function useToast() {
  const [toast, setToast] = useState<{
    message: string
    tone: ToastTone
  } | null>(null)

  const showToast = (message: string, tone: ToastTone = "info") => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }

  const ToastHost = () => {
    if (!toast) {
      return null
    }

    const toneClass =
      toast.tone === "success"
        ? "border-emerald-400/40 text-emerald-100"
        : toast.tone === "error"
          ? "border-red-400/40 text-red-100"
          : "border-white/15 text-white"

    return (
      <div className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border bg-[#101720] px-4 py-3 text-sm font-bold shadow-2xl ${toneClass}`}>
        {toast.message}
      </div>
    )
  }

  return { showToast, ToastHost }
}
