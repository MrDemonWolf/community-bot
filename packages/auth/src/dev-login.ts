import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

export function isLocalURL(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function devLoginEnabled(
  nodeEnv: string,
  flag: string,
  baseURL?: string,
) {
  return nodeEnv === "development" && flag === "true" && isLocalURL(baseURL);
}

export function devLoginPlugin(ownerEmail?: string): BetterAuthPlugin {
  return {
    id: "dev-login",
    endpoints: {
      devLogin: createAuthEndpoint(
        "/dev-login",
        { method: "POST", requireHeaders: true },
        async (ctx) => {
          const host = ctx.headers.get("host");
          const origin = ctx.headers.get("origin");
          // Recheck the request boundary even after startup gating; remote origins cannot mint a dev session.
          if (
            !host ||
            !isLocalURL("http://" + host) ||
            !origin ||
            !isLocalURL(origin) ||
            new URL(origin).host !== host
          ) {
            throw new APIError("NOT_FOUND");
          }
          const adapter = ctx.context.internalAdapter;
          const email = ownerEmail?.toLowerCase() ?? "dev@localhost";
          const existing = await adapter.findUserByEmail(email);
          const user =
            existing?.user ??
            (await adapter.createUser({
              email,
              name: "Nathanial (local dev)",
              emailVerified: true,
            }));
          const session = await adapter.createSession(user.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR");
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        },
      ),
    },
  };
}
