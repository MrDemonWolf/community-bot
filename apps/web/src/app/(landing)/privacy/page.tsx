import { env } from "@community-bot/env/web";

const companyName = env.NEXT_PUBLIC_COMPANY_NAME || "Community Bot";

export const metadata = {
  title: `Privacy Policy — ${companyName}`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 18, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            1. Introduction
          </h2>
          <p>
            {companyName} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            operates the Community Bot service (&quot;Service&quot;). This
            Privacy Policy explains how we collect, use, and protect your
            information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            2. Information We Collect
          </h2>
          <p>We collect the following types of information:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Account information:</strong> When you sign in via Twitch
              or Discord, we receive your username, user ID, avatar, and email
              address from the OAuth provider.
            </li>
            <li>
              <strong>Usage data:</strong> We log actions taken through the
              dashboard (e.g., command creation, bot configuration changes) for
              audit and moderation purposes.
            </li>
            <li>
              <strong>Chat data:</strong> The bot may process chat messages in
              channels where it is active to provide its features (commands,
              moderation, song requests, etc.).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            3. How We Use Your Information
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>To provide and maintain the Service</li>
            <li>To authenticate your identity and manage your account</li>
            <li>To enforce community rules and moderate content</li>
            <li>To improve and develop new features</li>
            <li>To communicate with you about the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            4. Data Storage and Security
          </h2>
          <p>
            Your data is stored in secured databases. We implement
            industry-standard security measures to protect your information.
            However, no method of transmission over the Internet is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            5. Third-Party Services
          </h2>
          <p>
            The Service integrates with third-party platforms (Twitch, Discord,
            YouTube). Your use of those platforms is governed by their respective
            privacy policies. We only access information necessary to provide
            our features.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            6. Cookies
          </h2>
          <p>
            We use cookies to maintain your session and remember your
            preferences. You can configure your browser to reject cookies, but
            this may limit your ability to use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            7. Data Retention
          </h2>
          <p>
            We retain your data for as long as your account is active or as
            needed to provide the Service. You may request deletion of your data
            by contacting us.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            8. Your Rights
          </h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            9. Children&apos;s Privacy
          </h2>
          <p>
            The Service is not intended for children under 13. We do not
            knowingly collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of significant changes by posting the new policy on this page
            with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            11. Contact
          </h2>
          <p>
            If you have questions about this Privacy Policy, please contact us
            through the channels listed on our website.
          </p>
        </section>
      </div>
    </div>
  );
}
