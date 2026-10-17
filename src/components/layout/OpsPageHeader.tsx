import type { ReactNode } from "react"

export default function OpsPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="ops-page-heading">
      <div>
        <p className="command-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="ops-page-heading-actions">{actions}</div> : null}
    </header>
  )
}
