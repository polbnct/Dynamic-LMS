import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/student/courses", destination: "/student/dashboard", permanent: true },
      { source: "/student/courses/:path*", destination: "/student/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
