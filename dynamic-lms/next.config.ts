import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // No custom redirects; student routes use /student/courses/... directly.
    return [];
  },
};

export default nextConfig;
