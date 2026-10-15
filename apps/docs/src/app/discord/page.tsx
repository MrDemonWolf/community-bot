export const metadata = { title: "Discord setup" };

export default function Discord() {
  return <>
    <p className="eyebrow">OPTIONAL CONNECTION · DISCORD</p>
    <h1>Bring your existing bot.</h1>
    <p className="lead">Keep the verified application you already have. This service connects the bot and displays the status you choose.</p>
    <h2>1. Collect three values</h2>
    <ol>
      <li>Open <a href="https://discord.com/developers/applications">Discord Developer Portal</a> and select your existing bot application.</li>
      <li>Copy the <strong>Application ID</strong> from General Information.</li>
      <li>Get the raw <strong>Bot token</strong> from the Bot section. Reset it only if you need a new one; a reset immediately invalidates the old token.</li>
      <li>In the Discord app, turn on <strong>User Settings → Advanced → Developer Mode</strong>. Right-click your community server and choose <strong>Copy Server ID</strong>.</li>
    </ol>
    <p className="result"><strong>Ready when:</strong> you have the application ID, server ID, and token. Keep the token private.</p>
    <h2>2. Save them in WolfAide</h2>
    <ol><li>Open Guided setup → Discord, or the dashboard's Discord application section.</li><li>Paste the three values into their labeled fields. Paste only the token, without a <code>Bot </code> prefix.</li><li>Choose <strong>Save Discord credentials</strong> and wait for the saved message.</li><li>If the bot is not installed in your server yet, choose <strong>Invite to server</strong> and select your server. Administrator permission is unnecessary.</li></ol>
    <p className="result"><strong>Ready when:</strong> credentials are saved and the bot appears in the correct server. It may still appear offline until you join.</p>
    <h2>3. Choose its presence</h2>
    <ol><li>Select Online, Idle, Do not disturb, or Invisible.</li><li>Select an activity and enter its text. Streaming also needs an HTTPS Twitch or YouTube URL.</li><li>Choose <strong>Save Discord presence</strong>.</li></ol>
    <p>Activities support Playing, Listening, Watching, Competing, Custom status, and Streaming. Leave the activity text empty to clear it. Invisible intentionally makes a connected bot appear offline in Discord.</p>
    <h2>4. Connect and check</h2>
    <ol><li>Open the dashboard and choose <strong>Join</strong> on Discord.</li><li>Wait for a fresh connected heartbeat.</li><li>Look at the bot in your server and check its chosen status and activity.</li></ol>
    <p className="result"><strong>Done when:</strong> WolfAide reports connected and Discord shows the presence you selected. Presence changes can take a few seconds.</p>
    <div className="callout"><p><strong>Keep the default access.</strong> The worker uses only the nonprivileged Guilds intent. Its own status does not need privileged Presence, Server Members, or Message Content access. This simple bot does not need higher limits or extra privileged-intent approval.</p></div>
    <h2>Pause without removing it</h2>
    <p><strong>Leave</strong> disconnects the worker. It does not kick the bot out of the server or erase credentials. Choose Join to reconnect. Run only one worker per bot token.</p>
    <h2>If something gets stuck</h2>
    <table><thead><tr><th>What you see</th><th>Do this next</th></tr></thead><tbody>
      <tr><td>Invalid credentials</td><td>Check the application ID belongs to the token you saved. Replace a reset token in the private dashboard.</td></tr>
      <tr><td>Server unavailable</td><td>Confirm the server ID is correct and the bot was invited to that server.</td></tr>
      <tr><td>Connected, but appears offline</td><td>Check whether your selected status is Invisible.</td></tr>
      <tr><td>No recent heartbeat</td><td>Start the Discord worker or check its deployment logs before changing credentials.</td></tr>
    </tbody></table>
    <details><summary>Reference: Discord limits</summary><p>The worker coalesces updates to stay below five presence updates per 20 seconds. Discord's ordinary Gateway event limit is 120 events per minute. Session-start allowances come from the current Gateway response; WolfAide does not increase your bot's approved limits. Application verification and privileged-intent approval are separate.</p></details>
    <p className="sources">Official references: <a href="https://docs.discord.com/developers/events/gateway">Discord Gateway</a> · <a href="https://docs.discord.com/developers/events/gateway-events#update-presence">Presence</a> · <a href="https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps">Privileged intents</a></p>
  </>;
}
