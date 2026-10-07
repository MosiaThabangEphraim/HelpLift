import path from "node:path"
import { fileURLToPath } from "node:url"

// This folder ("HelpLift App") is the project root. Without saying so, Next.js
// can pick the repository folder above it instead, and then the folder name -
// which has a space - ends up in Vercel's server function names, which Vercel
// rejects ("A Serverless Function has an invalid name").
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default nextConfig
