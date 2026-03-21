import Link from "next/link";
import type { Route } from "next";
import { Terminal, BookOpen, MessageSquare, Bell, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthCtaButton from "@/components/auth-cta-button";
import { getBroadcasterUserId } from "@/lib/setup";
import { db, eq, and, count, botChannels, twitchChatCommands, quotes } from "@community-bot/db";

const channelUrl = process.env.NEXT_PUBLIC_CHANNEL_URL;
const channelName = process.env.NEXT_PUBLIC_CHANNEL_NAME;

async function getPublicStats() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, broadcasterId),
    columns: { id: true },
  });
  if (!botChannel) return { commandCount: 0, quoteCount: 0 };

  const [[cmdCount], [quoteCount]] = await Promise.all([
    db.select({ value: count() }).from(twitchChatCommands).where(
      and(
        eq(twitchChatCommands.botChannelId, botChannel.id),
        eq(twitchChatCommands.enabled, true),
        eq(twitchChatCommands.hidden, false),
      ),
    ),
    db.select({ value: count() }).from(quotes).where(
      eq(quotes.botChannelId, botChannel.id),
    ),
  ]);

  return { commandCount: cmdCount.value, quoteCount: quoteCount.value };
}

const features = [
  {
    icon: MessageSquare,
    title: "Chat Commands",
    description:
      "Custom commands with variables, cooldowns, and access levels. Built to make chat management effortless.",
  },
  {
    icon: Bell,
    title: "Stream Notifications",
    description:
      "Automatic Discord notifications when you go live on Twitch. Keep your community in the loop.",
  },
  {
    icon: Users,
    title: "Viewer Queue",
    description:
      "Let viewers join a queue right from chat. Perfect for game nights and community events.",
  },
];

export default async function Home() {
  const stats = await getPublicStats();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-background px-6 pb-20 pt-24 sm:pb-32 sm:pt-32">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-main/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-brand-main/20 bg-brand-main/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-main">
            <span className="inline-block size-1.5 rounded-full bg-brand-main" />
            Community Hub
          </div>

          <h1
            className="animate-fade-in-up mt-8 font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: "100ms" }}
          >
            {channelName ? (
              <>
                Welcome to{" "}
                <span className="bg-gradient-to-r from-brand-main to-brand-main/70 bg-clip-text text-transparent">
                  {channelName}
                </span>
                {"'s Community"}
              </>
            ) : (
              "Welcome to the Community"
            )}
          </h1>

          <p
            className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
            style={{ animationDelay: "200ms" }}
          >
            Your central hub for stream interaction, commands, and community
            fun.
          </p>

          <div
            className="animate-fade-in-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            style={{ animationDelay: "300ms" }}
          >
            {channelUrl && channelName && (
              <Link href={channelUrl as Route}>
                <Button
                  size="lg"
                  className="w-full bg-brand-main px-8 font-semibold text-white shadow-lg shadow-brand-main/25 transition-all hover:bg-brand-main/90 hover:shadow-xl hover:shadow-brand-main/30 sm:w-auto"
                >
                  Visit Channel
                </Button>
              </Link>
            )}
            <AuthCtaButton />
            <Link href={"/p/commands" as Route}>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-border px-8 font-semibold text-foreground transition-colors hover:border-brand-main/50 hover:text-brand-main sm:w-auto"
              >
                View Commands
              </Button>
            </Link>
          </div>

          {stats && (
            <div
              className="animate-fade-in-up mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6"
              style={{ animationDelay: "400ms" }}
            >
              <div className="glass flex min-w-[160px] flex-col items-center gap-1 rounded-2xl px-8 py-5 transition-shadow hover:shadow-lg">
                <Terminal className="mb-1 size-5 text-brand-main" />
                <span className="font-heading text-3xl font-bold text-foreground">
                  {stats.commandCount}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Commands
                </span>
              </div>
              <div className="glass flex min-w-[160px] flex-col items-center gap-1 rounded-2xl px-8 py-5 transition-shadow hover:shadow-lg">
                <BookOpen className="mb-1 size-5 text-brand-main" />
                <span className="font-heading text-3xl font-bold text-foreground">
                  {stats.quoteCount}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Quotes
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 bg-muted/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Community Features
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Everything you need to interact with the stream.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="animate-fade-in-up glass group rounded-2xl border border-border/50 p-7 transition-all duration-300 hover:border-brand-main/30 hover:shadow-xl"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <div className="mb-4 inline-flex rounded-xl bg-brand-main/10 p-3 transition-colors group-hover:bg-brand-main/15">
                  <feature.icon className="size-6 text-brand-main" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
