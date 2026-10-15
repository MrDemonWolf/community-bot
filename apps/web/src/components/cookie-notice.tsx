"use client";

import { useEffect, useId, useState } from "react";

const STORAGE_KEY = "community-bot:cookie-notice";
const NOTICE_VERSION = "1";

export default function CookieNotice() {
  const titleId = useId();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== NOTICE_VERSION);
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, []);

  function dismiss() {
    // Storage can be blocked; acknowledging the notice must still close it for this visit.
    try { localStorage.setItem(STORAGE_KEY, NOTICE_VERSION); } catch {}
    setOpen(false);
  }

  return <div className="cookie-information">
    <button type="button" className="cookie-trigger" disabled={!ready} aria-expanded={open}
      aria-controls={`${titleId}-notice`} onClick={() => setOpen((current) => !current)}>
      Cookie information
    </button>
    {open && <section id={`${titleId}-notice`} className="cookie-notice" aria-labelledby={titleId}>
      <div><h2 id={titleId}>Cookies and browser storage</h2>
        <p>Essential cookies keep you signed in and protect account connections. Browser storage remembers this notice and your color theme. We do not use analytics or advertising cookies.</p>
        <a href="/privacy">Read the privacy information</a>
      </div>
      <button type="button" className="button primary" onClick={dismiss}>Got it</button>
    </section>}
  </div>;
}
