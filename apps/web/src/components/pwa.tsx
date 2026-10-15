"use client";

import { useEffect, useState } from "react";

export default function Pwa() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber-100 px-4 py-3 text-center font-semibold text-amber-950">You’re offline. Reconnect before changing bot settings.</div> : null;
}
