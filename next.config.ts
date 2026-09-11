import type { NextConfig } from "next";

// Static export: the whole experience ships as immutable static assets,
// ideal for Cloudflare Pages / any CDN edge delivery.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
