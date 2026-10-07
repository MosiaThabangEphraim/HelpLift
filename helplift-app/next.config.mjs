import path from "node:path"
import { fileURLToPath } from "node:url"

// This folder is the project root. Without saying so, Next.js can pick the
// repository folder above it instead, and the folder name then ends up in
// Vercel's server function names (which must not contain spaces - the reason
// this folder is called "helplift-app" rather than "HelpLift App").
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
