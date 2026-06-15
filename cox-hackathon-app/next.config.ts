import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Next doesn't infer it from a
  // stray parent lockfile (silences the multi-lockfile warning).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
