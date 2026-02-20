/**
 * Next.js instrumentation hook — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Used to generate the first-time setup token on startup so the URL
 * is available in the console before any requests arrive.
 */
export async function register() {
  // Only run on the Node.js runtime (skip Edge runtime) since we need
  // database access via Prisma, which isn't available in Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureSetupToken } = await import("@/lib/setup");
      await ensureSetupToken();
    } catch (error) {
      // Gracefully handle startup failures (e.g. database not ready yet
      // during Docker builds or CI). The setup token will be generated
      // on the next startup once the DB is available.
      console.warn("Setup token check failed (DB may not be ready yet):", error);
    }
  }
}
