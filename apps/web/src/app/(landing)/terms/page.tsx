import { env } from "@community-bot/env/web";

const companyName = env.NEXT_PUBLIC_COMPANY_NAME || "Community Bot";

export const metadata = {
  title: `Terms of Service — ${companyName}`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 18, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using the Community Bot service (&quot;Service&quot;)
            operated by {companyName} (&quot;we&quot;, &quot;us&quot;, or
            &quot;our&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p>
            The Service provides a community management bot for Twitch and
            Discord platforms, including a web dashboard for configuration and
            moderation tools. Features may change at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            3. User Accounts
          </h2>
          <p>
            You must authenticate via a supported third-party provider (Twitch
            or Discord) to use the Service. You are responsible for maintaining
            the security of your account and all activity that occurs under it.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            4. Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>
              Use the Service to harass, abuse, or harm other users or
              communities
            </li>
            <li>Reverse-engineer, decompile, or disassemble the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            5. Intellectual Property
          </h2>
          <p>
            The Service and its original content, features, and functionality
            are owned by {companyName} and are protected by applicable
            intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            6. Termination
          </h2>
          <p>
            We may terminate or suspend your access to the Service at any time,
            without prior notice, for conduct that we believe violates these
            Terms or is harmful to other users or us.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            7. Disclaimer of Warranties
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, whether express or
            implied. We do not guarantee that the Service will be uninterrupted,
            secure, or error-free.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            8. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, {companyName} shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            9. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. Continued
            use of the Service after changes constitutes acceptance of the
            updated Terms.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            10. Contact
          </h2>
          <p>
            If you have questions about these Terms, please contact us through
            the channels listed on our website.
          </p>
        </section>
      </div>
    </div>
  );
}
