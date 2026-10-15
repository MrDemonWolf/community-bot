import { auth } from "@community-bot/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Access from "./access";

export default async function AccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.emailVerified) redirect("/login");
  return <Access userName={session.user.name} />;
}
