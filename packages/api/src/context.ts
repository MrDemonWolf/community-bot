import { auth } from "@community-bot/auth";
import { db } from "@community-bot/db";
import { userMeta } from "@community-bot/db/schema/userMeta";
import { RoleSchema, type Role } from "@community-bot/shared/roles";
import { eq } from "drizzle-orm";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  let role: Role = "guest";
  if (session?.user?.id) {
    const rows = await db
      .select({ role: userMeta.role })
      .from(userMeta)
      .where(eq(userMeta.userId, session.user.id))
      .limit(1);
    const parsed = RoleSchema.safeParse(rows[0]?.role);
    role = parsed.success ? parsed.data : "viewer";
  }

  return {
    auth: null,
    session,
    user: session?.user ?? null,
    role,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
