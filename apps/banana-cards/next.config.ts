import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle
  // (same fix apps/inkwell needs, for the same reason).
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
