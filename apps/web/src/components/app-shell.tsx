"use client";

import { LogOut, Menu, MoreHorizontal, X } from "lucide-react";
import type { Subject } from "@community-bot/core/permissions";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { navigationFor, type NavigationItem } from "./navigation";
import { Modal } from "./modal";
import { UserAvatar } from "./user-avatar";

export default function AppShell({ children, userName, botName, access, publicPageEnabled }: {
  children: React.ReactNode;
  userName: string;
  botName: string;
  access: Subject;
  publicPageEnabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const navigation = navigationFor(access, publicPageEnabled);
  const primary = navigation.filter((item) => item.section === "primary");
  const secondaryActive = navigation.some((item) => item.section !== "primary" && item.href === pathname);

  // Server-rendered menu triggers stay disabled until their dialog handlers are hydrated.
  useEffect(() => { setReady(true); }, []);
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    const closeOnDesktop = () => { if (desktop.matches) setMoreOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  async function signOut() {
    setSigningOut(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Sign out failed. Please try again.");
      setMoreOpen(false); router.push("/login"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed. Please try again."); }
    finally { setSigningOut(false); }
  }

  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <Link href="/dashboard" className="brand shell-brand"><img src="/brand/logo.svg" alt="" width="38" height="38" /><span>Community Bot</span></Link>
      <div className="workspace-label">{access.owner ? "Creator workspace" : "Staff workspace"}</div>
      <nav aria-label="Main navigation">
        {primary.map((item) => <NavigationLink key={item.id} item={item} active={pathname === item.href} />)}
        {navigation.some((item) => item.section === "tools") && <span className="nav-group-label">Manage</span>}
        {navigation.filter((item) => item.section === "tools").map((item) => <NavigationLink key={item.id} item={item} active={pathname === item.href} />)}
        <span className="nav-group-label">Community</span>
        {navigation.filter((item) => item.section === "account").map((item) => <NavigationLink key={item.id} item={item} active={pathname === item.href} />)}
      </nav>
      <div className="sidebar-bottom"><div className="account"><UserAvatar userName={userName} /><span>{userName}<small>{botName}</small></span><button type="button" title="Sign out" aria-label="Sign out" disabled={signingOut} onClick={signOut}><LogOut size={19} /></button></div>{error && <p className="shell-error" role="alert">{error}</p>}</div>
    </aside>
    <div className="workspace-frame">
      <header className="mobile-topbar"><Link href="/dashboard" className="brand shell-brand"><img src="/brand/logo.svg" alt="" width="33" height="33" /><span>Community Bot<small>{botName}</small></span></Link><button type="button" className="shell-icon-button" aria-label="Open menu" aria-haspopup="dialog" aria-controls="more-title-dialog" aria-expanded={moreOpen} disabled={!ready} onClick={() => setMoreOpen(true)}><Menu size={23} /></button></header>
      <main id="main" className="workspace">{children}</main>
    </div>
    <nav className="mobile-tabs" aria-label="Primary navigation">
      {primary.map((item) => <NavigationLink key={item.id} item={item} active={pathname === item.href} mobile />)}
      <button type="button" aria-haspopup="dialog" aria-controls="more-title-dialog" aria-expanded={moreOpen} data-active={secondaryActive || moreOpen || undefined} disabled={!ready} onClick={() => setMoreOpen(true)}><MoreHorizontal size={23} /><span>More</span></button>
    </nav>
    <Modal open={moreOpen} onClose={() => setMoreOpen(false)} labelledBy="more-title" className="more-dialog">
      <div className="more-sheet"><div className="sheet-handle" aria-hidden="true" /><div className="more-heading"><h2 id="more-title">More</h2><button type="button" autoFocus className="shell-icon-button" aria-label="Close menu" onClick={() => setMoreOpen(false)}><X size={23} /></button></div>
        <div className="more-profile"><UserAvatar userName={userName} size={40} /><div><strong>{userName}</strong><span>{access.owner ? "Creator" : "Staff"} · {botName}</span></div></div>
        <nav aria-label="More navigation">{(["tools", "account"] as const).map((section) => {
          const items = navigation.filter((item) => item.section === section);
          return items.length ? <section className="more-group" key={section}><h3>{section === "tools" ? "Tools" : "Account & community"}</h3><div>{items.map((item) => <NavigationLink key={item.id} item={item} active={pathname === item.href} onNavigate={() => setMoreOpen(false)} />)}</div></section> : null;
        })}</nav>
        {error && <p role="alert" className="notice error">{error}</p>}<button type="button" className="button more-signout" disabled={signingOut} onClick={signOut}><LogOut size={18} />{signingOut ? "Signing out…" : "Sign out"}</button>
      </div>
    </Modal>
  </div>;
}

function NavigationLink({ item, active, mobile, onNavigate }: { item: NavigationItem; active: boolean; mobile?: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return <Link href={item.href} aria-current={active ? "page" : undefined} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} onClick={onNavigate}><Icon size={mobile ? 23 : 19} aria-hidden="true" /><span>{mobile ? item.mobileLabel ?? item.label : item.label}</span>{item.external && <span className="nav-external" aria-hidden="true">↗</span>}</Link>;
}
