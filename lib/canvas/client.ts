import type {
  CanvasUser,
  CanvasCourse,
  CanvasAssignment,
  CanvasCalendarEvent,
  CanvasEnrollment,
  CanvasAnnouncement,
  CanvasModule,
} from "./types";
import { CanvasError } from "./types";
import { getCached, setCached } from "./cache";

const RATE_LIMIT_WARN_THRESHOLD = 50;

// TTLs for each endpoint category
const TTL = {
  courses: 5 * 60 * 1000,      // 5 min
  assignments: 2 * 60 * 1000,  // 2 min
  assignment: 5 * 60 * 1000,   // 5 min (individual, rarely changes)
  calendar: 1 * 60 * 1000,     // 1 min (events change frequently)
  grades: 5 * 60 * 1000,       // 5 min
  announcements: 2 * 60 * 1000,// 2 min
  modules: 5 * 60 * 1000,      // 5 min
} as const;

export class CanvasClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private userId?: string
  ) {}

  async validateAndGetUser(): Promise<CanvasUser> {
    return this.request<CanvasUser>("/api/v1/users/self");
  }

  async listCourses(): Promise<CanvasCourse[]> {
    return this.withCache(
      "courses",
      TTL.courses,
      () => this.paginate<CanvasCourse>(
        `${this.baseUrl}/api/v1/courses?enrollment_state=active&per_page=50`
      )
    );
  }

  async listAssignments(params?: {
    courseId?: number;
    dueBefore?: string;
    dueAfter?: string;
    buckets?: string;
  }): Promise<CanvasAssignment[]> {
    if (params?.courseId) {
      const cacheKey = `assignments:${params.courseId}:${params.dueBefore ?? ""}:${params.dueAfter ?? ""}:${params.buckets ?? ""}`;
      return this.withCache(cacheKey, TTL.assignments, () => {
        const qs = new URLSearchParams({ per_page: "50" });
        if (params.dueBefore) qs.set("due_before", params.dueBefore);
        if (params.dueAfter) qs.set("due_after", params.dueAfter);
        if (params.buckets) qs.set("bucket", params.buckets);
        return this.paginate<CanvasAssignment>(
          `${this.baseUrl}/api/v1/courses/${params.courseId}/assignments?${qs}`
        );
      });
    }
    // Cross-course: get all courses then their assignments in parallel (capped at 5 courses)
    const courses = await this.listCourses();
    const results = await Promise.all(
      courses.slice(0, 5).map((c) => this.listAssignments({ ...params, courseId: c.id }))
    );
    return results.flat();
  }

  async getAssignment(courseId: number, assignmentId: number): Promise<CanvasAssignment> {
    return this.withCache(
      `assignment:${courseId}:${assignmentId}`,
      TTL.assignment,
      () => this.request<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}`
      )
    );
  }

  async getCalendar(startDate: string, endDate: string): Promise<CanvasCalendarEvent[]> {
    return this.withCache(
      `calendar:${startDate}:${endDate}`,
      TTL.calendar,
      () => {
        const qs = new URLSearchParams({
          "context_codes[]": "user_self",
          start_date: startDate,
          end_date: endDate,
          per_page: "50",
        });
        return this.paginate<CanvasCalendarEvent>(
          `${this.baseUrl}/api/v1/calendar_events?${qs}`
        );
      }
    );
  }

  async getGrades(): Promise<CanvasEnrollment[]> {
    return this.withCache(
      "grades",
      TTL.grades,
      () => this.paginate<CanvasEnrollment>(
        `${this.baseUrl}/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=50`
      )
    );
  }

  async listAnnouncements(courseId?: number): Promise<CanvasAnnouncement[]> {
    return this.withCache(
      `announcements:${courseId ?? "all"}`,
      TTL.announcements,
      async () => {
        if (courseId) {
          return this.paginate<CanvasAnnouncement>(
            `${this.baseUrl}/api/v1/courses/${courseId}/discussion_topics?only_announcements=true&per_page=10`
          );
        }
        const courses = await this.listCourses();
        const contextCodes = courses.map((c) => `course_${c.id}`).join("&context_codes[]=");
        return this.paginate<CanvasAnnouncement>(
          `${this.baseUrl}/api/v1/announcements?context_codes[]=${contextCodes}&per_page=20`
        );
      }
    );
  }

  async listModules(courseId: number): Promise<CanvasModule[]> {
    return this.withCache(
      `modules:${courseId}`,
      TTL.modules,
      () => this.paginate<CanvasModule>(
        `${this.baseUrl}/api/v1/courses/${courseId}/modules?per_page=50`
      )
    );
  }

  // Cache wrapper: skips cache if no userId was provided
  private async withCache<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.userId) return fn();

    const cached = await getCached<T>(this.userId, key);
    if (cached !== null) return cached;

    const data = await fn();
    await setCached(this.userId, key, data, ttlMs).catch(() => {
      // Non-fatal: cache write failure should never break the request
    });
    return data;
  }

  // Follows Link rel="next" headers until exhausted
  private async paginate<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      this.checkRateLimit(res.headers);

      if (!res.ok) {
        throw new CanvasError(
          `Canvas API error ${res.status} at ${nextUrl}`,
          res.status
        );
      }

      const page = (await res.json()) as T[];
      results.push(...page);
      nextUrl = parseNextLink(res.headers.get("Link"));
    }

    return results;
  }

  private async request<T>(path: string): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    this.checkRateLimit(res.headers);

    if (!res.ok) {
      throw new CanvasError(`Canvas API error ${res.status}`, res.status);
    }

    return res.json() as Promise<T>;
  }

  private checkRateLimit(headers: Headers): void {
    const remaining = headers.get("X-Rate-Limit-Remaining");
    if (remaining && Number(remaining) < RATE_LIMIT_WARN_THRESHOLD) {
      console.warn(`Canvas rate limit low: ${remaining} requests remaining`);
    }
  }
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}
