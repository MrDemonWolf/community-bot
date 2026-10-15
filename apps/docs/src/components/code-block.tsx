"use client";

import { useState } from "react";

export default function CodeBlock({ children }: { children: string }) {
  const [message, setMessage] = useState("");
  return <div className="code-block"><button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(children); setMessage("Copied"); }
    catch { setMessage("Select the text to copy"); }
  }}>{message || "Copy"}</button><pre><code>{children}</code></pre><span className="sr-only" role="status">{message}</span></div>;
}
