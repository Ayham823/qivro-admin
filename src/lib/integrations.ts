export type IntegrationDefinition = {
  key: string
  name: string
  category: "Analytics" | "Monitoring" | "Engineering" | "Cloud" | "Revenue"
  description: string
  envKey: string
  url?: string
}

export const integrations: IntegrationDefinition[] = [
  {
    key: "ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    description: "Acquisition, traffic, campaign, and audience reporting.",
    envKey: "NEXT_PUBLIC_GA4_URL",
    url: process.env.NEXT_PUBLIC_GA4_URL,
  },
  {
    key: "posthog",
    name: "PostHog",
    category: "Analytics",
    description: "Product events, funnels, experiments, and session replay.",
    envKey: "NEXT_PUBLIC_POSTHOG_URL",
    url: process.env.NEXT_PUBLIC_POSTHOG_URL,
  },
  {
    key: "sentry",
    name: "Sentry",
    category: "Monitoring",
    description: "Frontend, admin, backend, and AI error investigation.",
    envKey: "NEXT_PUBLIC_SENTRY_URL",
    url: process.env.NEXT_PUBLIC_SENTRY_URL,
  },
  {
    key: "grafana",
    name: "Grafana",
    category: "Monitoring",
    description: "Operational dashboards, latency, workers, and infrastructure.",
    envKey: "NEXT_PUBLIC_GRAFANA_URL",
    url: process.env.NEXT_PUBLIC_GRAFANA_URL,
  },
  {
    key: "cloudwatch",
    name: "CloudWatch",
    category: "Cloud",
    description: "AWS logs, alarms, instance metrics, and deployment signals.",
    envKey: "NEXT_PUBLIC_CLOUDWATCH_URL",
    url: process.env.NEXT_PUBLIC_CLOUDWATCH_URL,
  },
  {
    key: "github",
    name: "GitHub",
    category: "Engineering",
    description: "Repositories, Actions, releases, checks, and deployments.",
    envKey: "NEXT_PUBLIC_GITHUB_URL",
    url: process.env.NEXT_PUBLIC_GITHUB_URL,
  },
  {
    key: "aws",
    name: "AWS Console",
    category: "Cloud",
    description: "EC2, S3, CloudFront, Route 53, IAM, and managed services.",
    envKey: "NEXT_PUBLIC_AWS_CONSOLE_URL",
    url: process.env.NEXT_PUBLIC_AWS_CONSOLE_URL,
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "Revenue",
    description: "Payments, subscriptions, refunds, and billing lifecycle.",
    envKey: "NEXT_PUBLIC_STRIPE_URL",
    url: process.env.NEXT_PUBLIC_STRIPE_URL,
  },
]
