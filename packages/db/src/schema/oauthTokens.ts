import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const ALLOWED_PURPOSES = ["twitch_broadcaster", "twitch_bot", "discord_bot"] as const;
export type OAuthPurpose = (typeof ALLOWED_PURPOSES)[number];

/**
 * Encrypted OAuth/bot tokens. Key version is embedded in the ciphertext
 * payload by packages/shared/crypto, so no separate version column.
 */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    purpose: text("purpose").$type<OAuthPurpose>().primaryKey(),
    accessCiphertext: text("access_ciphertext"),
    refreshCiphertext: text("refresh_ciphertext"),
    scope: text("scope"),
    accountLogin: text("account_login"),
    accountId: text("account_id"),
    expiresAt: timestamp("expires_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check(
      "oauth_tokens_purpose_check",
      sql`${t.purpose} IN (${sql.join(
        ALLOWED_PURPOSES.map((p) => sql`${p}`),
        sql`, `,
      )})`,
    ),
  ],
);
