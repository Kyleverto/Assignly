import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  timestamp,
  jsonb,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Better Auth core tables ---
// IDs are text (Better Auth generates UUID strings internally)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  // Canvas-specific custom fields (Better Auth additionalFields)
  canvasUserId: bigint("canvas_user_id", { mode: "number" }),
  canvasBaseUrl: text("canvas_base_url"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// --- Assignly app tables ---

export const canvasCredentials = pgTable(
  "canvas_credentials",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Only 'pat' — Canvas OAuth is not available without an approved developer key
    kind: text("kind").notNull().default("pat"),
    // Base64-encoded AES-256-GCM ciphertext of the Canvas Personal Access Token
    accessToken: text("access_token").notNull(),
    // Canvas PATs can have an optional expiry set at creation time.
    // Canvas doesn't expose this via API, so it's null unless we add a UI field for it.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    check("kind_check", sql`${t.kind} = 'pat'`),
  ]
);

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const canvasCache = pgTable(
  "canvas_cache",
  {
    userId: text("user_id").notNull(),
    cacheKey: text("cache_key").notNull(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cacheKey] })]
);
