import { env } from "@community-bot/env/server";
import { devLoginEnabled } from "@community-bot/auth/dev-login";
import Login from "./login";

// OAuth availability comes from deployment-time environment values, not the image's build environment.
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
