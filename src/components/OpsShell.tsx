"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  CheckSquare2,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react"
import AdminCommandPalette from "@/components/AdminCommandPalette"
import {
  adminNavGroups,
  adminNavItems,
  getActiveAdminNavItem,
  isAdminNavItemActive,
} from "@/lib/admin-navigation"
import { removeToken } from "@/lib/auth"

export type AdminUserIdentity = {
  id: string
  email: string
  role: string
  name?: string | null
}

const SIDEBAR_STORAGE_KEY = "qivro:admin-sidebar-collapsed"

const quickActions = [
  {
    href: "/moderation/reports",
    label: "Review reports",
    description: "Open the moderation queue",
    icon: ShieldAlert,
  },
  {
    href: "/ai/review-queue",
    label: "Review AI output",
    description: "Inspect uncertain AI responses",
    icon: Sparkles,
  },
  {
    href: "/tours",
    label: "Inspect tour jobs",
    description: "Review failed and queued work",
    icon: CheckSquare2,
  },
]

function environmentDetails() {
  const configured = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase()
  const browserApi = process.env.NEXT_PUBLIC_BROWSER_API_URL?.toLowerCase() ?? ""
  const value = configured || (
    browserApi.includes("localhost")
      ? "local"
      : browserApi.includes("staging")
        ? "staging"
        : "production"
  )

  if (value === "production") return { label: "Production", tone: "production" }
  if (value === "staging") return { label: "Staging", tone: "staging" }
  return { label: "Local", tone: "local" }
}

function userInitials(user?: AdminUserIdentity | null) {
  const source = user?.name?.trim() || user?.email || "Admin"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function userLabel(user?: AdminUserIdentity | null) {
  return user?.name?.trim() || user?.email?.split("@")[0] || "Admin"
}

export default function OpsShell({
  children,
  user,
}: {
  children: React.ReactNode
  user?: AdminUserIdentity | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const topbarMenusRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const activeItem = useMemo(() => getActiveAdminNavItem(pathname), [pathname])
  const environment = environmentDetails()
  const publicAppUrl = process.env.NEXT_PUBLIC_PUBLIC_APP_URL || "http://localhost:3010"

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
    setQuickActionsOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!topbarMenusRef.current?.contains(event.target as Node)) {
        setQuickActionsOpen(false)
        setProfileOpen(false)
      }
    }

    window.addEventListener("pointerdown", closeMenus)
    return () => window.removeEventListener("pointerdown", closeMenus)
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
  }

  const logout = () => {
    removeToken()
    router.push("/login")
  }

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("qivro:command"))
  }

  return (
    <div className={`ops-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <AdminCommandPalette items={adminNavItems} />

      {sidebarOpen ? (
        <button
          type="button"
          className="ops-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`ops-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="ops-brand">
          <div className="ops-brand-mark" aria-hidden="true">Q</div>
          <div className="ops-brand-copy">
            <strong>QIVRO</strong>
            <span>Command Center</span>
          </div>
          <button
            type="button"
            className="ops-sidebar-close"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="ops-nav" aria-label="Admin navigation">
          {adminNavGroups.map((group) => (
            <section key={group.label} className="ops-nav-group">
              <p>{group.label}</p>
              {group.items.map((item) => {
                const active = isAdminNavItemActive(pathname, item.href)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`ops-nav-link ${active ? "is-active" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </section>
          ))}
        </nav>

        <div className="ops-sidebar-footer">
          <Link
            href="/settings"
            className={`ops-nav-link ${pathname === "/settings" ? "is-active" : ""}`}
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            className="ops-nav-link ops-collapse-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : undefined}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>

      <section className="ops-workspace">
        <header className="ops-topbar">
          <button
            type="button"
            className="ops-mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="ops-route-context">
            <span>{activeItem?.group ?? "Command center"}</span>
            <strong>{activeItem?.label ?? "Qivro Admin"}</strong>
          </div>

          <button
            type="button"
            className="ops-search-trigger"
            onClick={openCommandPalette}
            aria-label="Open command palette"
          >
            <Search size={17} />
            <span>Search commands, pages, and operations</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="ops-topbar-actions" ref={topbarMenusRef}>
            <span className={`ops-environment is-${environment.tone}`}>
              <i aria-hidden="true" />
              {environment.label}
            </span>

            <div className="ops-popover-anchor">
              <button
                type="button"
                className="ops-quick-action-button"
                aria-label="Open quick actions"
                onClick={() => {
                  setQuickActionsOpen((current) => !current)
                  setProfileOpen(false)
                }}
                aria-expanded={quickActionsOpen}
                aria-haspopup="menu"
              >
                <Sparkles size={15} />
                <span>Quick actions</span>
                <ChevronDown size={14} />
              </button>

              {quickActionsOpen ? (
                <div className="ops-popover ops-quick-actions" role="menu">
                  <header>
                    <strong>Quick actions</strong>
                    <span>Move directly to work that needs attention.</span>
                  </header>
                  {quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <Link key={action.href} href={action.href} role="menuitem">
                        <Icon size={17} />
                        <span><strong>{action.label}</strong><small>{action.description}</small></span>
                      </Link>
                    )
                  })}
                  <a href={publicAppUrl} target="_blank" rel="noreferrer" role="menuitem">
                    <ExternalLink size={17} />
                    <span><strong>Open public product</strong><small>View the customer experience</small></span>
                  </a>
                </div>
              ) : null}
            </div>

            <div className="ops-popover-anchor">
              <button
                type="button"
                className="ops-user-menu"
                onClick={() => {
                  setProfileOpen((current) => !current)
                  setQuickActionsOpen(false)
                }}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="ops-avatar">{userInitials(user)}</span>
                <span className="ops-user-copy">
                  <strong>{userLabel(user)}</strong>
                  <span>{user?.role === "ADMIN" ? "Administrator" : "Verifying access"}</span>
                </span>
                <ChevronDown size={15} />
              </button>

              {profileOpen ? (
                <div className="ops-popover ops-profile-menu" role="menu">
                  <header>
                    <strong>{user?.name || "Qivro administrator"}</strong>
                    <span>{user?.email || "Session is being verified"}</span>
                  </header>
                  <Link href="/settings" role="menuitem"><Settings size={16} /> Settings</Link>
                  <a href={publicAppUrl} target="_blank" rel="noreferrer" role="menuitem"><ArrowUpRight size={16} /> Public product</a>
                  <button type="button" onClick={logout} role="menuitem"><LogOut size={16} /> Log out</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="ops-main">{children}</main>
      </section>
    </div>
  )
}
