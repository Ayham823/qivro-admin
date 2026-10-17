export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="ops-card p-6 text-sm font-bold text-[var(--ops-muted)]">
      {label}
    </div>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="ops-card border-red-400/30 p-6 text-sm font-bold text-red-200">
      {message}
    </div>
  )
}

export function EmptyBlock({
  title = "No records found",
  description = "Try changing filters or checking back later.",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="ops-card p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">
        {description}
      </p>
    </div>
  )
}
