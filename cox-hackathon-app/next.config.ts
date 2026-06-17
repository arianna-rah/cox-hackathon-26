import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Next doesn't infer it from a
  // stray parent lockfile (silences the multi-lockfile warning).
  turbopack: {
    root: path.join(__dirname),
  },
  // @react-three/fiber v9 and @react-three/drei v10 are ESM-only packages.
  // Vercel's production build uses webpack, which cannot import ESM packages
  // from node_modules without this setting. Without it the Canvas renders
  // nothing on Vercel while working fine locally (Turbopack handles ESM natively).
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;
