import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  CircleDollarSign,
  Database,
  FileClock,
  FlaskConical,
  GitBranch,
  Home,
  Languages,
  Layers3,
  ListChecks,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  description: string
  group: string
  icon: LucideIcon
  keywords?: string[]
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

function item(
  group: string,
  value: Omit<AdminNavItem, "group">
): AdminNavItem {
  return { ...value, group }
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Command center",
    items: [
      item("Command center", {
        href: "/overview",
        label: "Founder Dashboard",
        description: "Business, product, AI, and platform priorities.",
        icon: Home,
        keywords: ["mission control", "overview", "founder"],
      }),
      item("Command center", {
        href: "/metrics",
        label: "Analytics",
        description: "Funnels, events, conversion, and acquisition signals.",
        icon: BarChart3,
        keywords: ["ga4", "posthog", "conversion", "events"],
      }),
      item("Command center", {
        href: "/infrastructure",
        label: "System Health",
        description: "API, database, Redis, workers, and cloud health.",
        icon: Activity,
        keywords: ["database", "redis", "bullmq", "monitoring", "aws"],
      }),
      item("Command center", {
        href: "/integrations",
        label: "Connected Services",
        description: "GitHub, analytics, errors, cloud, and billing consoles.",
        icon: Boxes,
        keywords: ["github", "sentry", "grafana", "cloudwatch", "stripe"],
      }),
    ],
  },
  {
    label: "Marketplace",
    items: [
      item("Marketplace", {
        href: "/listings",
        label: "Listings",
        description: "Inventory, publishing state, and property quality.",
        icon: Building2,
        keywords: ["properties", "inventory", "moderation"],
      }),
      item("Marketplace", {
        href: "/users",
        label: "Users",
        description: "Accounts, roles, access, and profile state.",
        icon: Users,
        keywords: ["accounts", "owners", "buyers", "roles"],
      }),
      item("Marketplace", {
        href: "/leads",
        label: "Leads",
        description: "Inquiries, ownership, status, and conversion.",
        icon: ListChecks,
        keywords: ["inquiries", "crm", "conversion"],
      }),
      item("Marketplace", {
        href: "/payments",
        label: "Payments",
        description: "Revenue, plans, payment state, and billing operations.",
        icon: CircleDollarSign,
        keywords: ["stripe", "revenue", "plans", "billing"],
      }),
      item("Marketplace", {
        href: "/tours",
        label: "3D Tours",
        description: "Tour jobs, processing stages, failures, and review.",
        icon: Layers3,
        keywords: ["3d", "colmap", "gaussian", "worker", "pipeline"],
      }),
    ],
  },
  {
    label: "AI and data",
    items: [
      item("AI and data", {
        href: "/ai",
        label: "AI Usage",
        description: "Provider traffic, latency, cost, cache, and fallbacks.",
        icon: BrainCircuit,
        keywords: ["openai", "gemini", "cost", "latency", "prompts"],
      }),
      item("AI and data", {
        href: "/translations",
        label: "Translation Center",
        description: "Review and publish multilingual product copy.",
        icon: Languages,
        keywords: ["i18n", "arabic", "hebrew", "locale"],
      }),
      item("AI and data", {
        href: "/search-quality",
        label: "Search Quality",
        description: "Queries, zero-result searches, and relevance signals.",
        icon: Search,
        keywords: ["queries", "relevance", "zero results"],
      }),
      item("AI and data", {
        href: "/ranking-lab",
        label: "Ranking Lab",
        description: "Inspect and test listing ranking decisions.",
        icon: Workflow,
        keywords: ["score", "recommendation", "relevance"],
      }),
      item("AI and data", {
        href: "/ranking-feedback",
        label: "Ranking Feedback",
        description: "Review ranking outcomes and human feedback.",
        icon: ListChecks,
        keywords: ["review", "quality", "feedback"],
      }),
      item("AI and data", {
        href: "/experiments",
        label: "Experiments",
        description: "A/B variants, exposure, and outcome tracking.",
        icon: FlaskConical,
        keywords: ["ab test", "variants", "feature flags"],
      }),
    ],
  },
  {
    label: "Operations",
    items: [
      item("Operations", {
        href: "/ai/review-queue",
        label: "AI Review Queue",
        description: "Human review for uncertain or failed AI outputs.",
        icon: Bot,
        keywords: ["human review", "fallback", "failed"],
      }),
      item("Operations", {
        href: "/ai/evaluation",
        label: "AI Evaluation",
        description: "Quality evaluation, expected outputs, and scoring.",
        icon: Sparkles,
        keywords: ["evals", "quality", "expected output"],
      }),
      item("Operations", {
        href: "/deployments",
        label: "Deployments",
        description: "GitHub delivery status and environment releases.",
        icon: GitBranch,
        keywords: ["github", "ci", "cd", "production", "staging"],
      }),
      item("Operations", {
        href: "/audit",
        label: "Audit Logs",
        description: "Who changed what, when, and from where.",
        icon: FileClock,
        keywords: ["history", "security", "admin activity"],
      }),
      item("Operations", {
        href: "/exports",
        label: "Data Exports",
        description: "Generate and inspect controlled data exports.",
        icon: Database,
        keywords: ["csv", "backup", "download", "reports"],
      }),
    ],
  },
  {
    label: "Trust and safety",
    items: [
      item("Trust and safety", {
        href: "/moderation/reports",
        label: "Moderation Queue",
        description: "Review user reports and take enforcement actions.",
        icon: ShieldAlert,
        keywords: ["reports", "abuse", "moderation"],
      }),
      item("Trust and safety", {
        href: "/moderation/suspicious-listings",
        label: "Trust Signals",
        description: "Investigate suspicious inventory and risk signals.",
        icon: ShieldAlert,
        keywords: ["fraud", "risk", "suspicious"],
      }),
    ],
  },
]

export const adminUtilityItems: AdminNavItem[] = [
  item("Account", {
    href: "/settings",
    label: "Settings",
    description: "Admin preferences, environment, and access details.",
    icon: Settings,
    keywords: ["profile", "environment", "configuration"],
  }),
]

export const adminNavItems = [
  ...adminNavGroups.flatMap((group) => group.items),
  ...adminUtilityItems,
]

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === "/overview") return pathname === href || pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getActiveAdminNavItem(pathname: string) {
  return [...adminNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((entry) => isAdminNavItemActive(pathname, entry.href))
}
