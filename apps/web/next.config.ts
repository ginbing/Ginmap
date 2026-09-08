import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ginmap/config", "@ginmap/model", "@ginmap/db", "@ginmap/github", "@ginmap/analytics", "@ginmap/render", "@ginmap/hosted", "@ginmap/operations"],
  async rewrites() {
    return {
      afterFiles: [
        { source: "/:login.svg", destination: "/u/:login/card.svg" },
        { source: "/:login.json", destination: "/api/v1/users/:login/summary" },
        { source: "/:login/repositories/:owner/:repo", destination: "/u/:login/repositories/:owner/:repo" },
        { source: "/:login", destination: "/u/:login" },
      ],
    };
  },
};

export default nextConfig;
