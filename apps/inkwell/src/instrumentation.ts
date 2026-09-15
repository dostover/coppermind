// Next.js instrumentation hook - register() runs once when the server
// process starts, which is exactly where the job runner needs to be kicked
// off (once per process, not once per request). Guarded to the Node.js
// runtime since better-sqlite3 and the job runner aren't edge-compatible;
// this app has no edge routes, but register() runs for both runtimes.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobRunner } = await import("./lib/jobs");
    startJobRunner();
  }
}
