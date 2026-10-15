import StaffAccess from "./staff-access";
import { auth } from "@community-bot/auth";
import { resolveAccess } from "@community-bot/api/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function StaffAccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !(await resolveAccess(session.user)).owner) redirect("/dashboard");
  return <StaffAccess />;
}
