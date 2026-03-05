import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["inngest", "sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "api.worldlabs.ai" },
    ],
  },
  turbopack: {},
  webpack: (config) => {
    config.module.rules.push({
      test: /\.spz$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
