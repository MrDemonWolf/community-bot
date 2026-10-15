import { auth } from "@community-bot/auth";
import { resolveAccess } from "@community-bot/api/access";
import { canAccess } from "@community-bot/core/permissions";
import { getPersonalProfile } from "@community-bot/db/profile";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user.emailVerified || !canAccess(await resolveAccess(session.user), "dashboard:view")) return new NextResponse(null, { status: 404, headers });
  const profile = await getPersonalProfile(session.user.id);
  const image = profile.images.find((row) => row.source === profile.source);
  if (!image) return new NextResponse(null, { status: 404, headers });
  return new NextResponse(new Uint8Array(image.webp), {
    headers: { ...headers, "Content-Type": "image/webp", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
