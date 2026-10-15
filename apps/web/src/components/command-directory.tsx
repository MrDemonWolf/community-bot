"use client";

import { Check, Copy, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Panel } from "./dashboard-ui";
import { InlineSpinner } from "./loading-state";

export default function CommandDirectory({ commands, botName }: {
  commands: readonly { command: string; description: string }[];
  botName: string;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [copying, setCopying] = useState("");
  const [copied, setCopied] = useState("");
  const [failedCommand, setFailedCommand] = useState("");
  const fallback = useRef<HTMLInputElement>(null);
  const normalized = search.trim().toLowerCase();
  const results = commands.filter((item) => `${item.command} ${item.description}`.toLowerCase().includes(normalized));

  useEffect(() => {
    if (failedCommand) { fallback.current?.focus(); fallback.current?.select(); }
  }, [failedCommand]);

  async function copyCommand(command: string) {
    setCopying(command); setCopied(""); setFailedCommand("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(command);
      setCopied(command);
    } catch {
      setFailedCommand(command);
    } finally { setCopying(""); }
  }

  return <Panel id="commands" className="command-directory" aria-labelledby="commands-title">
    <div className="command-directory-heading"><h2 id="commands-title">Chat commands</h2><p>Use these commands in Twitch chat with {botName}. Available to everyone.</p></div>
    {commands.length ? <>
      <div className="command-directory-tools"><div className="command-directory-search"><label htmlFor={searchId}>Find a command</label>
        <div><Search size={17} aria-hidden="true" /><input id={searchId} type="search" value={search} placeholder="Search names or descriptions" onChange={(event) => setSearch(event.target.value)} /></div>
      </div><button className="button" type="button" disabled={!search} onClick={() => setSearch("")}>Clear search</button></div>
      <p className="command-directory-count" aria-live="polite" aria-atomic="true">{results.length} of {commands.length} commands</p>
      {results.length ? <table className="command-directory-table"><thead><tr><th scope="col">Command</th><th scope="col">What it does</th><th scope="col"><span className="sr-only">Copy</span></th></tr></thead>
        <tbody>{results.map((item) => <tr key={item.command}><td><code>{item.command}</code></td><td>{item.description}</td><td><button type="button" className="command-copy" aria-label={`Copy ${item.command}`} disabled={Boolean(copying)} onClick={() => void copyCommand(item.command)}>
          {copying === item.command ? <InlineSpinner /> : copied === item.command ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}<span className="sr-only">Copy</span>
        </button></td></tr>)}</tbody>
      </table> : <div className="command-directory-empty"><h3>No matching commands</h3><p>Try another name or description, or clear your search.</p></div>}
      {copied && <p className="command-directory-feedback" role="status">Copied {copied}.</p>}
      {failedCommand && <div className="command-directory-fallback"><p role="alert">Automatic copying is unavailable. Select the command below and copy it.</p>
        <label className="field">Command to copy<input ref={fallback} readOnly value={failedCommand} onFocus={(event) => event.currentTarget.select()} /></label>
        <button type="button" className="button" onClick={() => { fallback.current?.focus(); fallback.current?.select(); }}>Select command</button>
      </div>}
    </> : <div className="command-directory-empty"><p>No chat commands are enabled right now.</p></div>}
  </Panel>;
}
