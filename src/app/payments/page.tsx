"use client"

import { useEffect, useState } from "react"
import { CircleDollarSign, CreditCard, ReceiptText } from "lucide-react"
import GuardedOpsShell from "@/components/GuardedOpsShell"
import { ErrorBlock, LoadingBlock } from "@/components/StateBlock"
import { apiRequest, type OpsOverview } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { integrations } from "@/lib/integrations"

export default function PaymentsPage() {
  const [data, setData] = useState<OpsOverview | null>(null)
  const [error, setError] = useState("")
  const stripe = integrations.find((integration) => integration.key === "stripe")

  useEffect(() => {
    const token = getToken()
    if (!token) return
    apiRequest<OpsOverview>("/admin/overview", { token }).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Payments are unavailable"))
  }, [])

  return (
    <GuardedOpsShell>
      <div className="ops-page-heading"><div><p className="command-eyebrow">Revenue operations</p><h1>Payments</h1><p>Current Qivro payment totals and billing console access.</p></div></div>
      {error ? <ErrorBlock message={error} /> : null}
      {!data && !error ? <LoadingBlock label="Loading payment signals..." /> : null}
      {data ? (
        <div className="payment-grid">
          <PaymentCard icon={CircleDollarSign} label="Recorded revenue" value={`$${data.executive.paymentsTotal.toLocaleString()}`} />
          <PaymentCard icon={CreditCard} label="Paid payments" value={data.executive.paidPayments.toLocaleString()} />
          <PaymentCard icon={ReceiptText} label="Billing provider" value={stripe?.url ? "Connected" : "Not configured"} />
        </div>
      ) : null}
      <section className="ops-card payment-note"><h2>Billing lifecycle</h2><p>Detailed subscriptions, refunds, disputes, webhook health, MRR, and churn require a production billing provider integration. Until then this page reports only backend payment records.</p>{stripe?.url ? <a className="ops-button" href={stripe.url} target="_blank" rel="noreferrer">Open Stripe</a> : null}</section>
    </GuardedOpsShell>
  )
}

function PaymentCard({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return <article className="payment-card"><Icon size={21} /><span>{label}</span><strong>{value}</strong></article>
}
