"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import type { AdminNavItem } from "@/lib/admin-navigation"

function searchableText(item: AdminNavItem) {
  return [
    item.label,
    item.description,
    item.group,
    item.href,
    ...(item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase()
}

export default function AdminCommandPalette({ items }: { items: AdminNavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return items

    const terms = normalizedQuery.split(/\s+/)
    return items.filter((item) => {
      const text = searchableText(item)
      return terms.every((term) => text.includes(term))
    })
  }, [items, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setSelectedIndex(0)
  }, [])

  const navigate = useCallback((item: AdminNavItem) => {
    close()
    router.push(item.href)
  }, [close, router])

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }

      if (!open) return

      if (event.key === "Escape") {
        close()
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        setSelectedIndex((current) => (current + 1) % Math.max(results.length, 1))
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setSelectedIndex((current) => (current - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1))
      } else if (event.key === "Enter" && results[selectedIndex]) {
        event.preventDefault()
        navigate(results[selectedIndex])
      }
    }

    window.addEventListener("keydown", handleKey)
    window.addEventListener("qivro:command", handleOpen)
    return () => {
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("qivro:command", handleOpen)
    }
  }, [close, navigate, open, results, selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  if (!open) return null

  return (
    <div
      className="ops-command-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        className="ops-command-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Admin command palette"
      >
        <div className="ops-command-search">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, services, and operations"
            aria-label="Search admin operations"
            aria-controls="admin-command-results"
          />
          <button type="button" onClick={close} aria-label="Close command palette">
            <X size={18} />
          </button>
        </div>

        <div className="ops-command-meta">
          <span>{results.length} {results.length === 1 ? "result" : "results"}</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> open</span>
        </div>

        <div id="admin-command-results" className="ops-command-results" role="listbox">
          {results.length ? (
            results.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  type="button"
                  className={selectedIndex === index ? "is-selected" : ""}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => navigate(item)}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <span className="ops-command-icon"><Icon size={17} /></span>
                  <span className="ops-command-copy">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </span>
                  <small>{item.group}</small>
                </button>
              )
            })
          ) : (
            <div className="ops-command-empty">
              <Search size={22} />
              <strong>No matching operation</strong>
              <span>Try a page name, service, or task such as &quot;failed AI&quot;.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
