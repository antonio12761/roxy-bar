import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignore build errors in scripts directory
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // Exclude scripts directory from being processed
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /scripts\//,
    });
    
    return config;
  },
};

export default nextConfig;