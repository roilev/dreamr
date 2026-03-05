import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["inngest", "sharp"],
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
    config.module.rules.push({
      test: /[\\/]node_modules[\\/]@sparkjsdev[\\/]/,
      parser: { javascript: { url: false } },
    });
    return config;
  },
};

export default nextConfig;
