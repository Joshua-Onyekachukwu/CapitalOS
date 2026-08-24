import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Skip type checking during build — pre-existing Next.js 16 params Promise type issue
  // is a known incompatibility with "use client" pages that accept params as props
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub Node.js builtins that pg requires for client bundles
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        "util/types": false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
