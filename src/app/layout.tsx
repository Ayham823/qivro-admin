import type { Metadata } from "next"
import { connection } from "next/server"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Qivro Command Center",
    template: "%s | Qivro Command Center",
  },
  description: "Founder, operations, intelligence, and platform control center.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Per-request CSP nonces must be attached during rendering, not at build time.
  await connection()
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
