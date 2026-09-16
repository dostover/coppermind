import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle.
  // pdf-to-img (pdfPrep.ts) and its pdfjs-dist dependency locate their own
  // worker script at module-load time in a way that breaks when bundled -
  // Next's build-time route analysis fails evaluating it inline. Keeping
  // both external makes the API route require() them normally at runtime
  // instead, same fix as better-sqlite3 needed for a different reason.
  serverExternalPackages: ["better-sqlite3", "pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
