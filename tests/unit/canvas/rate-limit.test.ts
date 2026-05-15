import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { CanvasClient } from "@/lib/canvas/client";
import { CanvasError } from "@/lib/canvas/types";

const BASE = "https://canvas.test.edu";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("CanvasClient rate limit / error handling", () => {
  it("throws CanvasError with status 401 on unauthorized response", async () => {
    server.use(
      http.get(`${BASE}/api/v1/users/self`, () =>
        HttpResponse.json({ errors: [{ message: "Invalid token" }] }, { status: 401 })
      )
    );

    const client = new CanvasClient(BASE, "bad-token");
    await expect(client.validateAndGetUser()).rejects.toMatchObject({
      name: "CanvasError",
      status: 401,
    });
  });

  it("throws CanvasError with status 429 on rate limit response", async () => {
    server.use(
      http.get(`${BASE}/api/v1/courses`, () =>
        HttpResponse.json({ message: "Rate limit exceeded" }, { status: 429 })
      )
    );

    const client = new CanvasClient(BASE, "fake-token");
    let thrown: unknown;
    try {
      await client.listCourses();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(CanvasError);
    expect((thrown as CanvasError).status).toBe(429);
  });
});
