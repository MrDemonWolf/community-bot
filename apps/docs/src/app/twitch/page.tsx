import CodeBlock from "../../components/code-block";

export const metadata = { title: "Twitch setup" };

export default function Twitch() {
  return <>
    <p className="eyebrow">OPTIONAL CONNECTION · TWITCH</p>
    <h1>One channel.<br />Two account connections.</h1>
    <p className="lead">Your creator account identifies the channel. Your bot account reads chat and sends replies. Connect them separately so you always know who is speaking.</p>
    <h2>1. Register the Twitch application</h2>
    <ol><li>Open the <a href="https://dev.twitch.tv/console/apps">Twitch Developer Console</a> and create or select your application.</li><li>Register the exact callback URL shown in WolfAide's Twitch settings. For local development, use:</li></ol>
    <CodeBlock>{`http://localhost:3001/api/twitch/callback`}</CodeBlock>
    <p>For Dokploy, use your HTTPS dashboard hostname instead:</p>
    <CodeBlock>{`https://YOUR-DASHBOARD/api/twitch/callback`}</CodeBlock>
    <p>Copy the application's <strong>Client ID</strong> and generate or retrieve its <strong>Client Secret</strong>. Keep the secret private.</p>
    <p className="result"><strong>Ready when:</strong> the correct callback URL is registered and you have the two application values.</p>
    <h2>2. Save the application in WolfAide</h2>
    <ol><li>Open Guided setup → Twitch, or the dashboard's Twitch application section.</li><li>Paste the client ID and client secret.</li><li>Choose <strong>Save Twitch application</strong>.</li></ol>
    <p className="result"><strong>Ready when:</strong> the creator and bot Connect buttons become available.</p>
    <h2>3. Connect the creator</h2>
    <ol><li>Choose <strong>Connect creator</strong>.</li><li>On Twitch's consent screen, select your main streamer account and authorize it.</li><li>Back in WolfAide, confirm the creator username matches your channel.</li></ol>
    <h2>4. Connect the bot</h2>
    <ol><li>Choose <strong>Connect bot</strong>.</li><li>On Twitch's consent screen, select the separate bot account. Check the username before accepting.</li><li>If Twitch shows the creator instead, switch accounts there before authorizing. If needed, sign out of Twitch and sign into the bot account first.</li><li>Back in WolfAide, confirm the bot username is correct.</li></ol>
    <p className="result"><strong>Ready when:</strong> the dashboard lists the correct creator and bot usernames. Reconnect the relevant account if either is wrong.</p>
    <h2>5. Join and try one command</h2>
    <ol><li>Choose <strong>Join</strong> on the dashboard's Twitch panel.</li><li>Wait for a fresh connected heartbeat.</li><li>Open your Twitch channel chat and send <code>!uptime</code>.</li></ol>
    <p className="result"><strong>Done when:</strong> your bot replies with its process uptime. If you changed the prefix, use that prefix instead of <code>!</code>.</p>
    <h2>The commands</h2>
    <table><thead><tr><th>Command</th><th>Reply</th></tr></thead><tbody>
      <tr><td><code>!uptime</code>, <code>!botuptime</code></td><td>Time since the Twitch worker started.</td></tr>
      <tr><td><code>!streamuptime</code></td><td>Current broadcast duration, or an offline reply.</td></tr>
      <tr><td><code>!serveruptime</code></td><td>OS-reported host uptime. Containers may share their host's clock.</td></tr>
      <tr><td><code>!commands</code></td><td>The available commands.</td></tr>
    </tbody></table>
    <p>The prefix is configurable. A channel-wide cooldown prevents rapid command replies.</p>
    <h2>What the quick controls do</h2>
    <table><thead><tr><th>Control</th><th>Result</th></tr></thead><tbody>
      <tr><td>Join</td><td>Starts listening to channel chat through EventSub.</td></tr>
      <tr><td>Leave</td><td>Stops listening and replying. Keeps the saved account connections.</td></tr>
      <tr><td>Mute replies</td><td>Keeps listening but stops command replies. Unmute restores replies.</td></tr>
    </tbody></table>
    <p>Joining does not promise a Twitch bot badge or presence in the viewer list. Trust the worker's heartbeat to confirm it applied the requested state.</p>
    <h2>If something gets stuck</h2>
    <table><thead><tr><th>What you see</th><th>Do this next</th></tr></thead><tbody>
      <tr><td>Redirect mismatch</td><td>Copy the callback from WolfAide and compare it exactly with your Twitch application, including HTTP versus HTTPS.</td></tr>
      <tr><td>Wrong account connected</td><td>Reconnect that role and check the Twitch consent-screen username before accepting.</td></tr>
      <tr><td>Connected but no reply</td><td>Choose Unmute replies, check the configured prefix, and wait a few seconds between commands.</td></tr>
      <tr><td>Authorization error</td><td>Reconnect the affected account. Twitch may have revoked its permission.</td></tr>
    </tbody></table>
    <details><summary>Reference: login, scopes, and transport</summary><p>Google signs you into WolfAide. Twitch separately authorizes the creator and bot. The bot requests <code>user:read:chat</code> and <code>user:write:chat</code>. The creator connection identifies the channel. Optional staff role checks and rewards request additional creator scopes only after opting in; see <a href="../features/">Staff &amp; features</a>. This user-token flow uses Twurple EventSub WebSockets and Helix, with no TMI or IRC dependency. Tokens refresh automatically and are encrypted before storage.</p></details>
    <p className="sources">Official references: <a href="https://dev.twitch.tv/docs/chat/authenticating/">Chat authentication</a> · <a href="https://dev.twitch.tv/docs/chat/send-receive-messages/">EventSub and Helix</a> · <a href="https://twurple.js.org/">Twurple</a></p>
  </>;
}
