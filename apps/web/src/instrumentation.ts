export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSetupToken } = await import("@/lib/setup");
    await ensureSetupToken();
  }
}
