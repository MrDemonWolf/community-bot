export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureSetupToken } = await import("@/lib/setup");
      await ensureSetupToken();
    } catch (error) {
      console.warn("Setup token check failed (DB may not be ready yet):", error);
    }
  }
}
