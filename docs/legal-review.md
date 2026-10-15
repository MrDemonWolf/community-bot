# Compliance check: Community Bot privacy and terms

Reviewed October 15, 2026 using the legal:compliance-check skill. This is a product compliance review, not legal advice; qualified legal review is recommended before public launch.

## Summary

**Proceed with conditions.** Public `/privacy` and `/terms` drafts describe the current single-creator service. They do not establish that hosting, deletion operations, or provider-console configuration meet every applicable requirement.

## Applicable regulations and policies

| Policy | Relevance and required action |
| --- | --- |
| [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) and [User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) | Sign-in-only apps still need accurate disclosures, minimal scopes, secure tokens, and appropriate public homepage/privacy/terms URLs. Match production consent-screen configuration to actual behavior. |
| [Discord Developer Terms, section 5](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service) | Accessible privacy/deletion contact; delete unneeded/requested API data and protect API data, including encryption at rest. Application token encryption alone does not establish encrypted hosting/backups for all API records. |
| [Twitch Developer Services Agreement](https://legal.twitch.com/legal/developer-agreement) | Public disclosures of collection, use, sharing, storage and retention; review cookie security and provider data-removal obligations. Official search indexing exposed agreement text, but the direct page body did not extract reliably; verify the rendered agreement before launch. |
| [ICO cookie guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) | Essential requested-service cookies may be exempt from prior consent; information is still required. A dismissed notice is not consent for future analytics. Assess UK/EU rules if users there are in scope. |
| Applicable privacy law | Jurisdictions, statutory thresholds, processing roles, lawful bases, transfers and required rights procedures depend on the actual operator, hosting and audience. Do not claim universal GDPR/CCPA compliance. |

## Requirements

| Requirement | Status | Action |
| --- | --- | --- |
| Data-specific notice and terms | Drafted | Pages cover Google account/session information, linked identities, tokens, role checks, private images, reward text/history and public channel output. No invented address, governing law or paid-service clauses. |
| Accurate contact | Sourced, operation unverified | `legal@mrdemonwolf.com` appears in the local website's current privacy and terms content. Confirm the inbox is monitored for this service. |
| Accessible links and cookie notice | Coordinated, verification pending | Other agents own public login/footer links and essential-storage notice. Verify they work without signing in and can be used with keyboard/mobile. |
| Hosting and backup disclosures | Unknown | Confirm operator/controller, hosts, processing locations, access controls, encryption at rest for all API data, backup retention and any cross-border safeguards. Update notice before launch. |
| Retention/deletion operations | Incomplete | No age-based account/reward purge or self-service full deletion exists. Unlink removes identity/token, not copied images, Google records or reward history. Establish a manual rights-request procedure, deadlines and backup handling; test deletion/revocation, including relevant provider tokens. |
| Provider console URLs and scopes | Not verified live | Set published privacy/terms/home URLs, owned domains and HTTPS redirects; check Google branding/scopes and Discord/Twitch app policy URLs. Do not infer this from repository pages. |

## Risk areas

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Request contact exists in copy but deletion is not carried out | High | Assign a monitored inbox owner; document verification and deletion of account, identity, copied images and community records as applicable. |
| Operational storage/backups are less protected than tokens | High | Confirm infrastructure encryption and access controls; the app encrypts credentials, not every database field. |
| Unknown location/retention makes public disclosure incomplete | Medium | Supply actual deployment facts and review applicable rights/transfer obligations before public launch. |
| Future trackers are treated as covered by today's notice | Medium | Current app has no analytics/ads; reassess notice and prior consent before introducing nonessential storage. |

## Recommended actions and approvals

1. Operator confirms hosting, retention, monitored contact and deletion procedures before launch.
2. Operator verifies public routes, deployed cookies/storage and provider-console URLs with real consent flows.
3. Qualified counsel reviews territorial scope, lawful bases, rights notices and any additional mandatory disclosures. Approval is pending; no legal approval or certification is implied.

## Implementation evidence

Reviewed auth/schema, role resolver and protected procedures, identity/OAuth disconnect behavior, personal image schema/serving, reward queue, public-channel projection and offline service worker. Access/refresh-token encryption is configured; personal images are per-session-user, three binary WebP slots of at most 256 KiB each. Image metadata is stripped. General chat is processed without a chat-history table; redemption text is persisted. Session lifetime defaults to seven days; app linking cookies expire after ten minutes. The cookie notice records dismissal locally; the color-theme preference is also browser-local. Neither authorizes analytics or advertising.

Contact conventions were read from the local `mrdemonwolf/website` repo; its analytics, reCAPTCHA, sales terms and conflicting location/jurisdiction text were not copied into this service.

## Legal document UX review

The revised pages preserve the full policy and terms and add a clearly subordinate quick-read summary. Desktop contents stay beside a bounded reading column; mobile uses a native contents disclosure with direct section links. The policy itself stays expanded. Updated date, operator identity and contact remain visible, with the same public header used by other public pages. Semantic colors and inherited website fonts support both light and dark themes. No acceptance checkbox or extra consent claim was added.

Primary guidance checked:

- [ICO: drafting privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/how-should-we-draft-our-privacy-information/) supports short, familiar language, descriptive headings and direct access. It explains the Article 12 transparency/readability standards. The ICO marks this guidance as under review following the Data (Use and Access) Act; its presence does not establish that the service satisfies all applicable UK requirements.
- [ICO: methods and layered notices](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/) supports giving key information first while keeping detailed information accessible, including on small screens.
- [FTC: consumer privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy) emphasizes explaining actual data use and honoring privacy promises. This review adds navigation and summaries, not new claims about compliance, deletion deadlines or infrastructure.

Inspected visual references:

- [MasterClass privacy policy](https://mobbin.com/screens/59ce80a7-3445-40cc-a1d5-5f32d8125987): a persistent contents rail, clear policy title/date, and visible request action. Used the navigation hierarchy, not its policy text or request tooling.
- [Codecademy article layout](https://mobbin.com/screens/41ef4d64-14cc-4361-b939-3b4c7c960153): a restrained reading measure and compact contents. Used as a document-navigation reference, not a legal-policy reference.

Mobbin search also returned employment-contract editors, which were not suitable patterns for public legal pages. No reference images or third-party legal copy were embedded. Launch requirements above, including verification of the contact inbox, remain unresolved by this visual redesign.
