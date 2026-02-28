import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { BookOpen, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return {};

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
    select: { name: true },
  });

  if (!user) return {};

  return {
    title: `Quotes — ${user.name}`,
    description: `Browse ${user.name}'s memorable quotes from stream.`,
  };
}

async function getQuotesData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: broadcasterId },
    select: { id: true },
  });

  if (!botChannel) return null;

  const quotes = await prisma.quote.findMany({
    where: { botChannelId: botChannel.id },
    orderBy: { quoteNumber: "asc" },
    select: {
      id: true,
      quoteNumber: true,
      text: true,
      game: true,
      addedBy: true,
    },
  });

  return { quotes };
}

export default async function QuotesPage() {
  const data = await getQuotesData();
  if (!data) return notFound();

  const { quotes } = data;

  return (
    <>
      <div className="animate-fade-in-up flex items-center gap-3">
        <Link
          href={"/p" as Route}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Quotes</h1>
        <span className="rounded-md bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
          {quotes.length}
        </span>
      </div>

      {quotes.length > 0 ? (
        <div
          className="animate-fade-in-up overflow-hidden rounded-lg border border-border bg-card"
          style={{ animationDelay: "100ms" }}
        >
          <ol className="divide-y divide-border">
            {quotes.map((quote, i) => (
              <li
                key={quote.id}
                className="animate-fade-in-up flex items-start gap-4 px-4 py-3 transition-colors hover:bg-surface-raised"
                style={{ animationDelay: `${150 + i * 50}ms` }}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised font-mono text-sm font-bold text-muted-foreground">
                  {quote.quoteNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    &ldquo;{quote.text}&rdquo;
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {quote.game && (
                      <span className="rounded bg-brand-twitch/10 px-1.5 py-0.5 text-xs text-brand-twitch">
                        {quote.game}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      — {quote.addedBy}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div
          className="animate-fade-in-up rounded-lg border border-border bg-card p-8 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No quotes yet.</p>
        </div>
      )}
    </>
  );
}
