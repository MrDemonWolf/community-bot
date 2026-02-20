import { prisma } from "@community-bot/db";
import SetupWizard from "./setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Check if setup is already complete
  const setupComplete = await prisma.systemConfig.findUnique({
    where: { key: "setupComplete" },
  });
  if (setupComplete?.value === "true") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Setup Complete</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This instance has already been set up.
          </p>
          <a
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-brand-main hover:text-brand-main/80"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  // Validate the token
  const storedToken = await prisma.systemConfig.findUnique({
    where: { key: "setupToken" },
  });

  if (!storedToken || storedToken.value !== token) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">
            Invalid or Expired Link
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This setup link is invalid or has already been used.
          </p>
        </div>
      </div>
    );
  }

  return <SetupWizard token={token} />;
}
