import { env } from "@community-bot/env/server";
import { devLoginEnabled } from "@community-bot/auth/dev-login";
import Login from "./login";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Login
      devLogin={devLoginEnabled(
        env.NODE_ENV,
        env.DEV_LOGIN,
        env.BETTER_AUTH_URL,
      )}
      googleConfigured={Boolean(
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
      )}
    />
  );
}
