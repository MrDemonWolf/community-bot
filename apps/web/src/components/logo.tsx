import Link from "next/link";
import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 ${className ?? ""}`}
    >
      <Image
        src="/logo-white-border.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8"
      />
      <span className="text-lg font-bold tracking-tight">
        <span className="text-brand-main">Community</span> Bot
      </span>
    </Link>
  );
}
