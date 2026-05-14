import { describe, it, expect } from "vitest";
import { neon } from "@neondatabase/serverless";

// Requires DATABASE_URL in env. Skipped when not set (CI without DB).
const dbUrl = process.env.DATABASE_URL;

describe.skipIf(!dbUrl)("DB connection", () => {
  it("can connect and run a basic query", async () => {
    const sql = neon(dbUrl!);
    const result = await sql`SELECT 1 AS value`;
    expect(result[0].value).toBe(1);
  });
});
