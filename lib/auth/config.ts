import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Google OAuth is the primary login method for the app.
  // Canvas connection is handled separately via PAT (see lib/canvas/client.ts).
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  user: {
    additionalFields: {
      canvasUserId: {
        type: "number",
        required: false,
        defaultValue: null,
        input: false,
      },
      canvasBaseUrl: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
