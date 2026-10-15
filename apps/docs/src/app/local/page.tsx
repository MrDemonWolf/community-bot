import Link from "next/link";
import CodeBlock from "../../components/code-block";

export const metadata = { title: "Local development" };

export default function Local() {
  return <>
    <p className="eyebrow">LOCAL SETUP · START HERE ON YOUR MAC</p>
    <h1>Get the dashboard open.</h1>
    <p className="lead">Use the full Docker stack for the fewest moving parts. Use native development when you want individual apps running in your terminal. Both paths use the same settings.</p>
    <h2>1. Check your tools</h2>
    <p>You need Git, Bun 1.4.3, and a current Docker Compose with Watch support. On macOS, Colima can run the Docker engine. For a fresh Colima session, start it with mount-event forwarding enabled:</p>
    <CodeBlock>{`git --version
bun --version
docker compose version
colima start --mount-inotify`}</CodeBlock>
    <p className="result"><strong>Ready when:</strong> the first three commands print a version and the Docker engine is running. If you use Docker Desktop, open it instead of running Colima.</p>
    <h2>2. Get the code and private settings</h2>
    <p><strong>First checkout only:</strong> clone the repository and enter its folder. Skip this if you already cloned it; open a terminal in that existing repository instead.</p>
    <CodeBlock>{`git clone https://github.com/MrDemonWolf/community-bot.git
cd community-bot`}</CodeBlock>
    <p>Run from the repository root. Copy the example only on your first setup; do not overwrite an existing <code>.env</code>.</p>
    <CodeBlock>{`cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32`}</CodeBlock>
    <p>Each command prints a value. Put the first hex value into <code>POSTGRES_PASSWORD</code>, the second into <code>BETTER_AUTH_SECRET</code>, and the base64 value into <code>APP_ENCRYPTION_KEY</code>. Keep them private.</p>
    <p>Edit <code>.env</code> to match this shape, replacing the uppercase placeholders. The password in both lines must be identical.</p>
    <CodeBlock>{`POSTGRES_PASSWORD=YOUR_FIRST_HEX_VALUE
DATABASE_URL=postgresql://community_bot:YOUR_FIRST_HEX_VALUE@localhost:5435/community_bot
BETTER_AUTH_SECRET=YOUR_SECOND_HEX_VALUE
APP_ENCRYPTION_KEY=YOUR_BASE64_VALUE
BETTER_AUTH_URL=http://localhost:3001
OWNER_EMAIL=you@example.com
NODE_ENV=development
DEV_LOGIN=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=`}</CodeBlock>
    <p className="result"><strong>Ready when:</strong> all three secrets are filled in and <code>.env</code> is untracked. Google and platform credentials can stay empty.</p>
    <h2>3A. Recommended: run everything in Docker</h2>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=50 web discord twitch`}</CodeBlock>
    <p>In a second terminal at the repository root, start the worker watcher and leave it running:</p>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml watch --no-up discord twitch`}</CodeBlock>
    <p>The first build can take several minutes. PostgreSQL starts first, migrations create the tables, and the three apps start after that. Web source stays bind-mounted and Webpack polls for changes. For workers, Compose watches files on your Mac, synchronizes source changes, and restarts only the affected service. Stopping the Watch terminal does not stop the containers.</p>
    <p>This avoids relying on Colima's experimental mount-event forwarding, which can miss worker reloads and file deletions. Rebuild after dependency or configuration changes. If Compose rejects <code>develop.watch</code> or <code>initial_sync</code>, update Docker Compose.</p>
    <p className="result"><strong>Ready when:</strong> <a href="http://localhost:3001">localhost:3001</a> shows the login page. Choose <strong>Enter development workspace</strong>.</p>
    <h2>3B. Alternative: run apps in your terminal</h2>
    <div className="callout"><p><strong>One worker per bot.</strong> Do not run a native Discord or Twitch worker alongside its Docker counterpart. Before switching from 3A to 3B, press Control-C in the Watch terminal first, then stop the Docker apps:</p></div>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml stop web discord twitch`}</CodeBlock>
    <p>Choose this instead of 3A. Start only the database and migration container:</p>
    <CodeBlock>{`bun install --frozen-lockfile
docker compose -f compose.yaml -f compose.dev.yaml up --build -d postgres migrate`}</CodeBlock>
    <p>If you already have a reachable, empty PostgreSQL database, set its <code>DATABASE_URL</code> in <code>.env</code> and run <code>bun run db:migrate</code> instead of starting these containers.</p>
    <p>Open separate terminal tabs at the repository root. Start the dashboard first:</p>
    <CodeBlock>{`bun run dev:web`}</CodeBlock>
    <p>When you want each bot running, use one terminal tab per command:</p>
    <CodeBlock>{`bun run dev:discord`}</CodeBlock>
    <CodeBlock>{`bun run dev:twitch`}</CodeBlock>
    <p>These scripts load the root <code>.env</code>. Keep them running; Control-C stops that process. Native workers watch for source changes.</p>
    <p className="result"><strong>Ready when:</strong> the dashboard opens at <a href="http://localhost:3001">localhost:3001</a> and the workers report fresh heartbeats. A paused, unconfigured worker is normal.</p>
    <h2>Check one source edit</h2>
    <p>Edit a visible label in <code>apps/web/src/app/login/login.tsx</code>, save the file, and refresh the login page.</p>
    <p className="result"><strong>Ready when:</strong> the changed label appears. If it does not, restart the affected app using the troubleshooting steps below.</p>
    <p>For a Docker worker, save a source edit and check the Watch terminal reports a sync and restart. Then confirm its dashboard heartbeat is fresh.</p>
    <h2>4. Sign in and connect one account</h2>
    <p>Development login works only with <code>NODE_ENV=development</code>, <code>DEV_LOGIN=true</code>, and a loopback HTTP dashboard URL. It signs in locally as <code>OWNER_EMAIL</code>. It never enables a production bypass.</p>
    <p>Follow the setup screens. Choose <Link href="/discord/">Discord</Link> or <Link href="/twitch/">Twitch</Link>, save its credentials, and choose Join on the dashboard. Google can be configured later.</p>
    <h2>5. Open the docs while you work</h2>
    <CodeBlock>{`bun run dev:docs`}</CodeBlock>
    <p>Open <a href="http://localhost:3004">localhost:3004</a>. This app does not require the database.</p>
    <h2>Stop safely</h2>
    <p>Testing home-screen installation? See the <Link href="/features/">PWA install guide</Link>. Development disables the service worker so it cannot cache stale source code; use a production build for install testing.</p>
    <p>Press Control-C in the Watch terminal first, then stop the stack:</p>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml down`}</CodeBlock>
    <p>This stops the containers and keeps the database volume. Do not add <code>-v</code> unless you intend to erase the database. Keep the same <code>APP_ENCRYPTION_KEY</code> when you restart.</p>
    <h2>If something gets stuck</h2>
    <table><thead><tr><th>What you see</th><th>Do this next</th></tr></thead><tbody>
      <tr><td>Docker daemon unavailable</td><td>For a fresh Colima session, run <code>colima start --mount-inotify</code>, or open Docker Desktop. Retry the Compose command.</td></tr>
      <tr><td>Database connection refused</td><td>Check PostgreSQL is running and the native URL uses <code>localhost:5435</code>, not the container hostname <code>postgres</code>.</td></tr>
      <tr><td>No development login button</td><td>Check the three development-login settings above, then restart the web app.</td></tr>
      <tr><td>Stale heartbeat</td><td>Check that worker&apos;s terminal or container logs. Do not reconnect accounts until the worker is running.</td></tr>
      <tr><td>Web source edit did not reload</td><td>Refresh the page; if needed, restart the Docker web service using the command below. For native web, press Control-C and rerun its development command.</td></tr>
      <tr><td>Worker source edit did not reload</td><td>For Docker, confirm the Watch terminal is running and has synchronized the file. Restarting alone cannot copy unsynchronized source. For native workers, press Control-C and rerun the affected worker's development command.</td></tr>
    </tbody></table>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml restart web`}</CodeBlock>
    <p>If you are not using Watch, rebuild the changed worker to copy its source. Use <code>twitch</code> instead of <code>discord</code> for that worker:</p>
    <CodeBlock>{`docker compose -f compose.yaml -f compose.dev.yaml up --build -d discord`}</CodeBlock>
    <p className="sources">Official references: <a href="https://docs.docker.com/compose/how-tos/file-watch/">Compose Watch</a> · <a href="https://docs.docker.com/reference/compose-file/develop/">Watch actions</a> · <a href="https://colima.run/docs/configuration/#mount-inotify">Colima mount-event forwarding</a> · <a href="https://lima-vm.io/docs/config/mount/#mount-inotify">Lima mount-event limits</a></p>
    <p>Next: <Link href="/discord/">connect Discord</Link> or <Link href="/twitch/">connect Twitch</Link>.</p>
  </>;
}
