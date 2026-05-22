import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["foliate-js"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/read",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
