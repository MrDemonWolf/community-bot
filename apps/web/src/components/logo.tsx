import Link from "next/link";

export default function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`text-lg font-bold tracking-tight ${className ?? ""}`}
    >
      <span className="text-brand-main">Community</span>{" "}
      <span className="text-foreground">Bot</span>
    </Link>
  );
}
