import { redirect } from "next/navigation";

// Entry point — bounce into the dashboard, which gates on auth + setup state.
export default function Home() {
  redirect("/dashboard");
}
