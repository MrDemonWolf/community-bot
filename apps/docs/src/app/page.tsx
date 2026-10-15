import Link from "next/link";

export default function Start() {
  return <>
    <p className="eyebrow">START HERE · NO PLATFORM ACCOUNTS NEEDED YET</p>
    <h1>Your bot.<br />One step at a time.</h1>
    <p className="lead">Get the dashboard open first. Then connect Discord or Twitch. You can leave the other service for another day.</p>
    <h2>1. Pick where to run it</h2>
    <div className="cards">
      <Link className="card" href="/local/"><span className="eyebrow">START WITH THIS</span><strong>On your Mac →</strong><p>Try the dashboard and develop locally. Google login can wait. Uses Bun and a local PostgreSQL database.</p></Link>
      <Link className="card" href="/dokploy/"><span className="eyebrow">WHEN YOU ARE READY</span><strong>On your Dokploy server →</strong><p>Keep it online for your community. Requires an HTTPS domain and Google owner login.</p></Link>
    </div>
    <div className="callout"><p><strong>New version, new database.</strong> This rewrite starts with an empty PostgreSQL database. Do not point it at an old deployment database. Keep the old database and its encryption key backed up until you have a migration plan.</p></div>
    <h2>2. Connect one service</h2>
    <p>Once you can sign in, follow one of these short guides. Account credentials are entered in the private dashboard.</p>
    <div className="cards">
      <Link className="card" href="/discord/"><strong>Connect Discord →</strong><p>Use your existing verified bot. Set its status and activity.</p></Link>
      <Link className="card" href="/twitch/"><strong>Connect Twitch →</strong><p>Link the creator and bot accounts. Try your first command.</p></Link>
    </div>
    <h2>3. Check the result</h2>
    <ol><li>Open the dashboard and choose <strong>Join</strong> on the service you configured.</li><li>Wait for a fresh <strong>connected</strong> status. The dashboard refreshes every five seconds.</li><li>Check the Discord presence, or type <code>!uptime</code> in your Twitch chat.</li></ol>
    <div className="callout"><p><strong>Saved does not mean connected.</strong> Saving credentials prepares the bot. Join asks the worker to connect. Its fresh heartbeat confirms it actually connected.</p></div>
    <h2>What runs where?</h2>
    <table><thead><tr><th>Part</th><th>Job</th></tr></thead><tbody>
      <tr><td><code>apps/web</code></td><td>Private owner dashboard and optional public channel page.</td></tr>
      <tr><td><code>apps/discord</code></td><td>Your Discord connection and presence.</td></tr>
      <tr><td><code>apps/twitch</code></td><td>Your Twitch chat connection and commands.</td></tr>
      <tr><td>PostgreSQL</td><td>Settings, encrypted tokens, login sessions, and service heartbeats.</td></tr>
      <tr><td><code>apps/docs</code></td><td>This public guide. No database or private credentials needed.</td></tr>
    </tbody></table>
    <p>The app uses Better-T-Stack: Next.js, TypeScript, tRPC, Better Auth, Drizzle, PostgreSQL, Bun, and Turborepo.</p>
  </>;
}
