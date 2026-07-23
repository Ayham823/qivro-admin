import type { NextConfig } from "next"

const internalApiUrl = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://backend:3001/api"
).replace(/\/$/, "")

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: internalApiUrl + "/:path*",
      },
    ]
  },
}

export default nextConfig
