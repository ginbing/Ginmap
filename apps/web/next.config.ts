import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ginmap/config", "@ginmap/model", "@ginmap/db", "@ginmap/github", "@ginmap/analytics", "@ginmap/render", "@ginmap/hosted", "@ginmap/operations"],
  async headers() {
    return [
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      afterFiles: [
        { source: "/:login.svg", destination: "/u/:login/card.svg" },
        { source: "/:login.json", destination: "/api/v1/users/:login/summary" },
        { source: "/:login/embed", destination: "/u/:login/embed" },
        { source: "/:login/repositories/:owner/:repo", destination: "/u/:login/repositories/:owner/:repo" },
        { source: "/:login", destination: "/u/:login" },
      ],
    };
  },
};

export default nextConfig;
