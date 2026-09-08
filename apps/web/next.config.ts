import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ginmap/config", "@ginmap/model", "@ginmap/db", "@ginmap/github", "@ginmap/analytics", "@ginmap/render"],
};

export default nextConfig;
