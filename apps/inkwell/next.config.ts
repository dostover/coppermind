import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle.
  // pdf-to-img (pdfPrep.ts) and its pdfjs-dist dependency locate their own
  // worker script at module-load time in a way that breaks when bundled -
  // Next's build-time route analysis fails evaluating it inline. Keeping
  // both external makes the API route require() them normally at runtime
  // instead, same fix as better-sqlite3 needed for a different reason.
  serverExternalPackages: ["better-sqlite3", "pdf-to-img", "pdfjs-dist"],
  // Next 16 blocks its dev scripts for any host other than localhost, so
  // opening Inkwell from a phone at the Mac's network address loads the page
  // but never makes it interactive (the Upload button stays disabled). Allow
  // the Mac's .local name and private home-network addresses. Dev server only;
  // `next start` ignores this.
  allowedDevOrigins: [
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ],
};

export default nextConfig;
