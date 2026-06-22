import { createFileRoute, redirect } from "@tanstack/react-router";

// Entry point — bounce into the dashboard, which gates on auth + setup state.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
