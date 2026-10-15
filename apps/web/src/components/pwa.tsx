"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function Pwa() {
  const [offline, setOffline] = useState(false);
  const banner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!offline || !banner.current) return;
    // The notice can wrap with viewport width or text size; fixed navigation must reserve its real height.
    const updateHeight = () => document.documentElement.style.setProperty("--offline-banner-height", `${banner.current?.getBoundingClientRect().height ?? 0}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--offline-banner-height"); };
  }, [offline]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Development must fetch fresh code instead of inheriting an offline shell during hot reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <div ref={banner} role="status" className="offline-banner border-b border-amber-200 bg-amber-100 px-4 py-3 text-center font-semibold text-amber-950">You’re offline. Reconnect before changing bot settings.</div> : null;
}
