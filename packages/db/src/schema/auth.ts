import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("UserRole", [
  "USER",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
]);

export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("USER"),
    banned: boolean("banned").notNull().default(false),
    bannedAt: timestamp("bannedAt"),
    banReason: text("banReason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
    lastLoginMethod: text("lastLoginMethod"),
  },
  (t) => [uniqueIndex("User_email_key").on(t.email)]
);

export const sessions = pgTable(
  "Session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull(),
  },
  (t) => [
    uniqueIndex("Session_token_key").on(t.token),
    index("Session_userId_idx").on(t.userId),
  ]
);

export const accounts = pgTable(
  "Account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("Account_userId_idx").on(t.userId)]
);

export const verifications = pgTable(
  "Verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("Verification_identifier_idx").on(t.identifier)]
);
