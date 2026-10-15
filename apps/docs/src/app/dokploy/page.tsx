import Link from "next/link";
import CodeBlock from "../../components/code-block";

export const metadata = { title: "Dokploy deployment" };

export default function Dokploy() {
  return <>
    <p className="eyebrow">PRODUCTION SETUP · DOKPLOY</p>
    <h1>Put your bot online.</h1>
    <p className="lead">Deploy one Compose stack. Web, Discord, and Twitch run separately and share PostgreSQL. Only the dashboard needs a public domain.</p>
    <div className="callout"><p><strong>Trying it on your Mac?</strong> Use the <Link href="/local/">local setup guide</Link> first. Production requires Google owner login; local development can skip it.</p></div>
    <h2>1. Have these ready</h2>
    <ul><li>A working Dokploy server connected to this GitHub repository.</li><li>A dashboard hostname whose DNS points at that server.</li><li>The verified Google email you will use as the owner.</li><li>A new, empty database volume for this rewrite.</li></ul>
    <p>Do not reuse the old bot database without a backup and an explicit migration plan. This initial migration does not upgrade the former Supabase schema.</p>
    <h2>2. Create the Compose deployment</h2>
    <ol><li>Create a project in Dokploy, then add a <strong>Docker Compose</strong> service.</li><li>Choose this GitHub repository and your intended branch.</li><li>Use the repository root as the build context and <code>compose.yaml</code> as the Compose file.</li></ol>
    <p className="result"><strong>Ready when:</strong> the deployment points at the repository and the root Compose file. Do not add the local <code>compose.dev.yaml</code> override.</p>
    <h2>3. Generate three private values</h2>
    <p>Run these on your Mac. Save each result in a password manager:</p>
    <CodeBlock>{`openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32`}</CodeBlock>
    <p>The first is your database password. The second is the authentication secret. The third is the encryption key. Keep that encryption key for every future deployment; replacing it prevents saved bot credentials from decrypting.</p>
    <h2>4. Set up Google owner login</h2>
    <ol><li>Create or select a Google OAuth project and web application client in Google Cloud Console.</li><li>Configure the consent screen. If the app is in testing, add your owner Google account as a test user.</li><li>Add this exact authorized redirect URI, replacing the hostname:</li></ol>
    <CodeBlock>{`https://YOUR-DASHBOARD/api/auth/callback/google`}</CodeBlock>
    <p>Save the client ID and client secret. Set <code>OWNER_EMAIL</code> to the verified Google email you will sign in with. Other accounts receive dashboard permissions only through the platform role mappings you configure.</p>
    <h2>5. Fill Dokploy's private environment editor</h2>
    <p>Replace every uppercase placeholder below. Do not put these values in Git or Docker build arguments.</p>
    <CodeBlock>{`POSTGRES_PASSWORD=YOUR_FIRST_HEX_VALUE
BETTER_AUTH_SECRET=YOUR_SECOND_HEX_VALUE
APP_ENCRYPTION_KEY=YOUR_BASE64_VALUE
BETTER_AUTH_URL=https://YOUR-DASHBOARD
OWNER_EMAIL=you@example.com
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
NODE_ENV=production
DEV_LOGIN=false`}</CodeBlock>
    <p>Use the exact dashboard origin with no path. Compose supplies the internal <code>DATABASE_URL</code>; you do not need to paste a database URL into this stack. Discord and Twitch credentials come later through the dashboard.</p>
    <p className="result"><strong>Ready when:</strong> secrets, hostname, Google credentials, and the owner email are filled in. Development login stays disabled.</p>
    <h2>6. Add the domain and deploy</h2>
    <ol><li>Add your dashboard domain to the <code>web</code> service on container port <code>3001</code>. Enable HTTPS.</li><li>Deploy the stack. PostgreSQL must become healthy before the one-shot <code>migrate</code> service runs.</li><li>Wait for migrations to exit successfully and web, Discord, and Twitch to start. Redeploy after domain changes if Dokploy needs to apply its routing labels.</li><li>Open your HTTPS dashboard and choose <strong>Continue with Google</strong>. Sign in with <code>OWNER_EMAIL</code>.</li></ol>
    <p className="result"><strong>Ready when:</strong> you reach the setup screens using your Google owner account. Unconfigured bot workers should be paused, not connected.</p>
    <div className="callout"><p><strong>Keep the other services private.</strong> PostgreSQL and both bot workers need no public domain or published port. Twitch uses outbound EventSub WebSockets, so no public webhook endpoint is needed.</p></div>
    <h2>7. Connect one service</h2>
    <p>Follow <Link href="/discord/">Discord setup</Link> or <Link href="/twitch/">Twitch setup</Link>. Save credentials, choose Join, and wait for the dashboard to show a fresh connected heartbeat. Use one replica per worker; stop the old bot deployment before starting a replacement using the same accounts.</p>
    <h2>Connect CI/CD when you are ready</h2>
    <p>GitHub CI checks types, tests, application builds, and a disposable Docker browser journey. The separate <strong>Deploy to Dokploy</strong> workflow is a manual action on main; it requires passing CI for the same commit and the configured production environment approval.</p>
    <p>Follow the repository's <a href="https://github.com/MrDemonWolf/community-bot/blob/main/docs/ci.md">CI and Dokploy deployment guide</a> to add the Dokploy URL, API key, and Compose service ID as GitHub environment secrets. Keep Dokploy's automatic Git deployment disabled if GitHub approval is your deployment gate.</p>
    <p>A queued deployment is not a successful rollout. After deploying, check HTTPS, Google owner login, and fresh bot heartbeats. Production still requires Google login even if you used local development login earlier.</p>
    <h2>Keep your data safe</h2>
    <p>Back up PostgreSQL and preserve <code>APP_ENCRYPTION_KEY</code> in a password manager. Keep the key separate from the database backup. Losing either can prevent recovery.</p>
    <p>If using Compose from a server shell, this creates a database backup in the current directory:</p>
    <CodeBlock>{`docker compose -f compose.yaml exec -T postgres pg_dump -U community_bot -d community_bot > community-bot.sql`}</CodeBlock>
    <p>Copy the backup off the server. Keep the <code>postgres_data</code> volume during updates. Do not use <code>docker compose down -v</code> unless you intend to erase it. Restore backups only into a separately prepared, empty database. An old image does not undo a database migration.</p>
    <h2>If something gets stuck</h2>
    <table><thead><tr><th>What you see</th><th>Do this next</th></tr></thead><tbody>
      <tr><td>Google redirect mismatch</td><td>Compare the exact HTTPS origin and callback path in Google with <code>BETTER_AUTH_URL</code>. Redeploy after correcting it.</td></tr>
      <tr><td>Owner access denied</td><td>Sign in with the verified email in <code>OWNER_EMAIL</code>. Check Google test-user access if the consent app is in testing.</td></tr>
      <tr><td>Migration failed</td><td>Read the <code>migrate</code> logs first. Confirm PostgreSQL is healthy and the database password matches. Do not erase an existing volume to guess at a fix.</td></tr>
      <tr><td>Stale bot heartbeat</td><td>Open that worker's logs in Dokploy. Confirm it is running and shares the database and encryption key with web.</td></tr>
    </tbody></table>
    <details><summary>Reference: separate applications, health checks, and public docs</summary>
      <h3>Deploying each app individually</h3><p>The root Dockerfile has <code>web</code>, <code>discord</code>, <code>twitch</code>, and <code>migrate</code> targets. Use the repository root as build context. Supply a shared reachable <code>DATABASE_URL</code> and the same encryption key to the apps. Run migrations once before starting code that requires them. The default Compose stack already handles this.</p>
      <h3>Health does not mean connected</h3><p>Discord exposes internal <code>/healthz</code> and <code>/readyz</code>; Twitch exposes <code>/health</code> and <code>/ready</code>. A paused worker can be healthy. Use the dashboard's fresh heartbeat to confirm the actual connection.</p>
      <h3>Publishing these docs</h3><p>The documentation workflow builds a static Next.js export for GitHub Pages. Select GitHub Actions as the Pages source in repository settings. The project base path is <code>/community-bot</code>. Docs builds require no private credentials or database. Configuring the workflow does not itself publish the site.</p>
    </details>
    <p className="sources">Official references: <a href="https://docs.dokploy.com/docs/core/docker-compose">Dokploy Compose</a> · <a href="https://docs.dokploy.com/docs/core/docker-compose/domains">Compose domains</a> · <a href="https://nextjs.org/docs/app/guides/static-exports">Next.js static exports</a> · <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages">GitHub Pages workflows</a></p>
  </>;
}
