import Link from "next/link";

export const metadata = { title: "Staff, features, and rewards" };

export default function Features() {
  return <>
    <p className="eyebrow">AFTER BASIC SETUP · ONE CHANGE AT A TIME</p>
    <h1>Share the work.<br />Keep control.</h1>
    <p className="lead">Connect one service first. Then map trusted staff, choose your features, and add Channel Point rewards when you need them.</p>
    <h2>1. Let people link their own accounts</h2>
    <ol><li>The creator registers the personal-account callback URLs shown in the dashboard's Discord and Twitch application settings. Discord also needs its OAuth application client secret.</li><li>A community member signs in with a verified Google account and opens <code>/access</code>.</li><li>They choose <strong>Link Twitch</strong> or <strong>Link Discord</strong> and authorize their own account.</li><li>They check the displayed username and their community roles. Staff tools appear only after a matching role mapping exists.</li></ol>
    <p className="result"><strong>Ready when:</strong> the member sees the correct linked identity. Linking an account alone does not grant staff access.</p>
    <h2>2. Map one trusted staff role</h2>
    <p>Only the creator can configure role mappings. Open <strong>Staff access</strong> at <code>/dashboard/access</code>.</p>
    <ol><li>Enable the role checks you need, then choose <strong>Save role checks</strong>. Twitch asks the creator to reauthorize the additional read permissions.</li><li>Choose where the role comes from: a Discord role ID or a Twitch native role.</li><li>Choose its Community Bot role and the platform tools it can use. Start with the same platform; add cross-platform access only deliberately.</li><li>Choose <strong>Save role mapping</strong>. Ask the member to refresh <code>/access</code>. Role checks may take up to a minute.</li></ol>
    <table><thead><tr><th>Role</th><th>Tools</th></tr></thead><tbody>
      <tr><td>Creator</td><td>Connections, credentials, workspace settings, role mappings, and all platform tools. Keeps access if a provider is unavailable.</td></tr>
      <tr><td>Admin</td><td>Platform feature settings, Discord presence, and reward configuration.</td></tr>
      <tr><td>Lead moderator</td><td>Moderator tools plus joining and leaving the platform connection.</td></tr>
      <tr><td>Moderator</td><td>Mute replies and manage the Twitch redemption queue when scoped to Twitch.</td></tr>
      <tr><td>VIP or subscriber</td><td>Community identity and supported role-based perks. No staff dashboard controls by default.</td></tr>
    </tbody></table>
    <p>The <strong>Add Twitch starter mappings</strong> button is optional. It maps Twitch's matching roles to Twitch tools and preserves existing customized mappings. Explicit Twitch lead moderator user IDs provide a creator-managed fallback for trusted leads.</p>
    <h2>3. Choose the built-in features</h2>
    <p>Open <strong>Features</strong> at <code>/dashboard/features</code>. Each platform has its own switch.</p>
    <ul><li><strong>Discord presence:</strong> the configured status and activity.</li><li><strong>Uptime commands:</strong> the shared command catalog, delivered as Twitch chat commands or Discord slash commands.</li><li><strong>Channel Point redeems:</strong> Twitch rewards and their response actions, disabled by default.</li></ul>
    <p>Enable or disable one feature, then wait for the worker to apply it. A Twitch admin cannot change Discord's switches without Discord access. These modules ship with the application; there are no uploaded scripts or third-party plugin downloads.</p>
    <h2>4. Authorize Channel Points</h2>
    <p>Open <strong>Channel points</strong> at <code>/dashboard/rewards</code>. You need an eligible Twitch Affiliate or Partner creator account.</p>
    <ol><li>The creator chooses <strong>Enable reward connection</strong>.</li><li>Choose <strong>Authorize rewards on Twitch</strong> and authorize the creator account, not the bot account.</li><li>Back in Community Bot, choose <strong>Refresh from Twitch</strong>. Check the creator's authorization and eligibility status.</li></ol>
    <p className="result"><strong>Ready when:</strong> the page shows authorized and eligible. Opting in requests the reward-management scope; it cannot make an ineligible account eligible.</p>
    <h2>5. Create one small reward</h2>
    <ol><li>An authorized platform admin enters a reward title, a positive points cost, and an optional prompt.</li><li>Choose whether a viewer message is required, then choose <strong>Create reward</strong>.</li><li>In the created reward, add an optional bot chat response. You can use <code>{"{user}"}</code>, <code>{"{input}"}</code>, and <code>{"{reward}"}</code> as placeholders.</li><li>Choose whether to automatically mark it complete after the bot action. Save the reward.</li></ol>
    <div className="callout"><p><strong>Start with manual fulfillment.</strong> Confirm a harmless redeem works before enabling automatic completion. Other applications' rewards stay read-only in Community Bot.</p></div>
    <h2>6. Keep the queue moving</h2>
    <p>Moderators with Twitch access can open the redemption queue and choose <strong>Mark fulfilled</strong> or <strong>Cancel &amp; refund</strong>. Review the viewer's message and action state first.</p>
    <p>Leaving or muting chat pauses automated chat replies. Reward events can still be collected. Failed or uncertain sends stay for manual review and are not retried automatically, preventing duplicate messages.</p>
    <h2>Install the dashboard on your phone</h2>
    <p>Open your production dashboard over HTTPS and sign in. Installation adds a convenient home-screen app; it does not move the bot onto your phone.</p>
    <ol><li><strong>iPhone or iPad:</strong> open the dashboard in Safari, choose Share, then Add to Home Screen.</li><li><strong>Android:</strong> open it in Chrome and use the browser menu's Install app or Add to Home screen action when available.</li><li><strong>Desktop Chrome:</strong> use the install icon in the address bar when available, then confirm installation.</li></ol>
    <p>If the browser does not offer installation, confirm you are on the HTTPS dashboard rather than the public documentation website. The manifest is available at <code>/manifest.webmanifest</code>.</p>
    <div className="callout"><p><strong>Offline means limited access.</strong> An offline banner explains the connection state. Only the static fallback is available offline; private dashboard HTML and API responses are not cached. Discord and Twitch keep running on your server while your phone is offline, but live status and controls need a connection.</p></div>
    <p>The development service worker is disabled to avoid stale code. A local production build on localhost can be eligible for installation. Physical iPhone and Android installation still needs device verification; browser builds alone do not prove it.</p>
    <h2>When something does not appear</h2>
    <table><thead><tr><th>What you see</th><th>Next step</th></tr></thead><tbody>
      <tr><td>Linked account, no dashboard</td><td>Check the creator's mapping, platform scope, and role-check setting. Linking is not a grant of staff access.</td></tr>
      <tr><td>Feature button disabled</td><td>Your role may have access to the other platform only. Ask the creator to review the mapping.</td></tr>
      <tr><td>Rewards need authorization</td><td>The creator must opt in and reauthorize the creator account before an admin can create rewards.</td></tr>
      <tr><td>Redeem did not send chat</td><td>Check the bot is joined, replies are unmuted, and the reward has a chat response. Review uncertain actions manually.</td></tr>
    </tbody></table>
    <p>Next: <Link href="/dokploy/">deployment and maintenance</Link>. Developer reference: <a href="https://github.com/MrDemonWolf/community-bot/blob/main/docs/features.md">shared feature architecture</a>.</p>
  </>;
}
