export default function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="ops-card p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ops-muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--ops-muted)]">{hint}</p> : null}
    </div>
  )
}
