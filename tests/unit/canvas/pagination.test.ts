import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { CanvasClient } from "@/lib/canvas/client";

// CanvasClient imports cache which imports the DB — mock it so unit tests
// run without DATABASE_URL
vi.mock("@/lib/canvas/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));

const BASE = "https://canvas.test.edu";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("CanvasClient pagination", () => {
  it("follows Link rel=next headers across multiple pages", async () => {
    server.use(
      http.get(`${BASE}/api/v1/courses`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") ?? "1";

        if (page === "1") {
          return HttpResponse.json(
            [{ id: 1, name: "Course A", course_code: "A", enrollment_term_id: 1, workflow_state: "available" }],
            {
              headers: {
                Link: `<${BASE}/api/v1/courses?page=2&per_page=50>; rel="next"`,
              },
            }
          );
        }
        if (page === "2") {
          return HttpResponse.json(
            [{ id: 2, name: "Course B", course_code: "B", enrollment_term_id: 1, workflow_state: "available" }],
            {
              headers: {
                Link: `<${BASE}/api/v1/courses?page=2&per_page=50>; rel="current"`,
              },
            }
          );
        }
        return HttpResponse.json([]);
      })
    );

    const client = new CanvasClient(BASE, "fake-token");
    const courses = await client.listCourses();
    expect(courses).toHaveLength(2);
    expect(courses[0].name).toBe("Course A");
    expect(courses[1].name).toBe("Course B");
  });
});
