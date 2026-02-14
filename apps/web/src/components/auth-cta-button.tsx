"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AuthCtaButton() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <Button
        size="lg"
        className="bg-[#00ACED] px-6 text-white hover:bg-[#0090c4]"
        disabled
      >
        &hellip;
      </Button>
    );
  }

  if (session) {
    return (
      <Link href="/dashboard">
        <Button
          size="lg"
          className="bg-[#00ACED] px-6 text-white hover:bg-[#0090c4]"
        >
          Dashboard
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/login">
      <Button
        size="lg"
        className="bg-[#00ACED] px-6 text-white hover:bg-[#0090c4]"
      >
        Log in
      </Button>
    </Link>
  );
}
