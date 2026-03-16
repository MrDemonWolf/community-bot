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
    <div className="-mt-[1px] flex flex-col">
      {/* Hero */}
      <section className="bg-background px-6 pb-16 pt-20 sm:pb-24">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animate-fade-in-up inline-block rounded-full border border-border/50 bg-brand-main/10 px-4 py-1.5 text-xs font-medium tracking-wider text-brand-main">
            COMMUNITY HUB
          </div>

          <h1 className="animate-fade-in-up mt-6 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl" style={{ animationDelay: "100ms" }}>
            {channelName ? (
              <>
                Welcome to{" "}
                <span className="text-brand-main">{channelName}</span>
                {"'s Community"}
              </>
            ) : (
              "Welcome to the Community"
            )}
          </h1>

          <p className="animate-fade-in-up mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg" style={{ animationDelay: "200ms" }}>
            Your central hub for stream interaction, commands, and community fun.
          </p>

          <div className="animate-fade-in-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "300ms" }}>
            {channelUrl && channelName && (
              <Link href={channelUrl as Route}>
                <Button
                  size="lg"
                  className="bg-brand-main px-6 text-white hover:bg-brand-main/80"
                >
                  Visit Channel
                </Button>
              </Link>
            )}
            <AuthCtaButton />
            <Link href={"/p/commands" as Route}>
              <Button size="lg" variant="outline" className="px-6">
                View Commands
              </Button>
            </Link>
          </div>

          {stats && (
            <div className="animate-fade-in-up mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6" style={{ animationDelay: "400ms" }}>
              <div className="glass flex min-w-[140px] flex-col items-center rounded-xl px-6 py-4">
                <Terminal className="mb-1.5 size-5 text-brand-main" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Commands
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {stats.commandCount}
                </span>
              </div>
              <div className="glass flex min-w-[140px] flex-col items-center rounded-xl px-6 py-4">
                <BookOpen className="mb-1.5 size-5 text-brand-main" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Quotes
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {stats.quoteCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-2xl font-bold text-foreground sm:text-3xl">
            Community Features
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
            Everything you need to interact with the stream.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="animate-fade-in-up glass rounded-xl border border-border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <feature.icon className="mb-3 size-6 text-brand-main" />
                <h3 className="mb-2 font-semibold text-foreground">
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
