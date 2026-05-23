import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(configDir, "../..", ".env");

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

// Minimal structural type for the webpack config we touch — avoids depending on
// `@types/webpack`, which isn't installed (Next bundles webpack at runtime).
type WebpackConfig = {
  resolve?: { extensionAlias?: Record<string, string[]> };
};

function withTypeScriptExtensionAliases(config: WebpackConfig): WebpackConfig {
  config.resolve ??= {};
  config.resolve.extensionAlias = {
    ...(config.resolve.extensionAlias ?? {}),
    ".js": [".js", ".ts", ".tsx"],
    ".mjs": [".mjs", ".mts"],
    ".cjs": [".cjs", ".cts"],
  };
  return config;
}

const config: NextConfig = {
  // React Compiler is enabled by default in Next.js 16.
  // Allow the dev server to serve assets/HMR when opened through a cloudflared
  // tunnel (Telegram Mini App testing). Harmless in production builds.
  allowedDevOrigins: ["*.trycloudflare.com"],
  transpilePackages: [
    "@meal-planner/ai",
    "@meal-planner/bot",
    "@meal-planner/db",
    "@meal-planner/domain",
    "@meal-planner/shared",
    "@meal-planner/ui",
  ],
  webpack: (webpackConfig) => withTypeScriptExtensionAliases(webpackConfig),
};

export default config;
