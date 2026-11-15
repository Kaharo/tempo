import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent prompts and YAML config are read at runtime; ship them with every server function.
  outputFileTracingIncludes: { "/**": ["./agents/**/*", "./config/**/*"] },
  serverExternalPackages: ["postgres"],
};
export default nextConfig;
