import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyShim = path.join(__dirname, "src/shims/empty.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@grefa/shared", "@grefa/firebase"],
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "expo-constants": emptyShim,
      "@react-native-async-storage/async-storage": emptyShim,
    };
    return config;
  },
};

export default nextConfig;
