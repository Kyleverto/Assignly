import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

vi.mock("@/lib/canvas/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));

const BASE = "https://canvas.test.edu";

const server = setupServer();
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  server.listen({ onUnhandledRequest: "warn" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Unit-test the validation logic in isolation (not the full route handler,
// which requires a DB. The full route is covered by integration tests in Iteration 6.)
describe("Canvas token validation logic", () => {
  it("accepts a valid Canvas user response", async () => {
    server.use(
      http.get(`${BASE}/api/v1/users/self`, () =>
        HttpResponse.json({ id: 12345, name: "Test Student", email: "test@uni.edu", login_id: "test" })
      )
    );

    const { CanvasClient } = await import("@/lib/canvas/client");
    const client = new CanvasClient(BASE, "valid-token");
    const user = await client.validateAndGetUser();
    expect(user.id).toBe(12345);
    expect(user.name).toBe("Test Student");
  });

  it("throws CanvasError on 401 from Canvas", async () => {
    server.use(
      http.get(`${BASE}/api/v1/users/self`, () =>
        HttpResponse.json({ errors: [{ message: "Invalid access token" }] }, { status: 401 })
      )
    );

    const { CanvasClient } = await import("@/lib/canvas/client");
    const { CanvasError } = await import("@/lib/canvas/types");
    const client = new CanvasClient(BASE, "bad-token");
    await expect(client.validateAndGetUser()).rejects.toBeInstanceOf(CanvasError);
  });
});
