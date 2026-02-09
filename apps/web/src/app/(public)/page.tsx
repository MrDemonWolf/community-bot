import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <span className="text-lg font-bold">MrDemonWolf</span>
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center px-4 py-20">
          <h1 className="mb-4 text-center text-4xl font-bold tracking-tight sm:text-5xl">
            MrDemonWolf Community Bot
          </h1>
          <p className="mb-8 max-w-lg text-center text-lg text-muted-foreground">
            Manage your Twitch community bot from the web. View analytics,
            manage users, and configure your bot all in one place.
          </p>
          <div className="flex gap-4">
            <Link href="/sign-in">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </section>

        <section className="border-t px-4 py-16">
          <div className="container mx-auto">
            <h2 className="mb-8 text-center text-2xl font-bold">Features</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Bot Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Monitor your bot&apos;s status, view commands, and manage
                    settings in real time.
                  </p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Coming Soon
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Manage community members, roles, and permissions from a
                    central dashboard.
                  </p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Coming Soon
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Analytics &amp; Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Track chat activity, command usage, and view detailed logs
                    for your community.
                  </p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Coming Soon
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>MrDemonWolf Community Bot</p>
      </footer>
    </div>
  );
}
