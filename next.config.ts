import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gzip would buffer the SSE stream in `next start` — events must flush immediately
  compress: false,
};

export default nextConfig;
