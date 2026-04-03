import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Legacy URLs: course pages moved under /student/dashboard only.
    return [
      {
        source: "/student/courses/:path*",
        destination: "/student/dashboard/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
