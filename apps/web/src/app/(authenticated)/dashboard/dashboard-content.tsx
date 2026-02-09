"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardContent({ userName }: { userName: string }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Dashboard</h1>
      <p className="mb-8 text-muted-foreground">Welcome back, {userName}</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Bot Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor your bot&apos;s status, view commands, and manage settings
              in real time.
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
              Manage community members, roles, and permissions from a central
              dashboard.
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
              Track chat activity, command usage, and view detailed logs for your
              community.
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Coming Soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
