import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: rootDir,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "icons.llama.fi",
      },
      {
        protocol: "https",
        hostname: "icons.llamao.fi",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "www.upshift.finance",
      },
    ],
  },
};

export default nextConfig;
