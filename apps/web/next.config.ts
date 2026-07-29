import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@grefa/shared", "@grefa/firebase"],
  reactStrictMode: true,
};

export default nextConfig;
