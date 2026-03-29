import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker では standalone 出力にしてランタイムを軽くします。
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
