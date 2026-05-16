import { tool } from "ai";
import { z } from "zod";
import type { CanvasClient } from "@/lib/canvas/client";
import type { DemoCanvasClient } from "@/lib/canvas/demo-client";
import { CanvasError } from "@/lib/canvas/types";

type AnyCanvasClient = CanvasClient | DemoCanvasClient;

const TOKEN_EXPIRED_MESSAGE =
  "Your Canvas access token has expired or is no longer valid. " +
  "Please go to Settings to update it, then try again.";

function wrapCanvasCall<T>(fn: () => Promise<T>): Promise<T | string> {
  return fn().catch((err) => {
    if (err instanceof CanvasError && err.status === 401) {
      return TOKEN_EXPIRED_MESSAGE;
    }
    throw err;
  });
}

// Returns a map of course_id → course name. listCourses() is cached at 5 min
// so this is essentially a single DB lookup after the first call in a session.
async function getCourseNameMap(client: AnyCanvasClient): Promise<Map<number, string>> {
  const courses = await client.listCourses();
  return new Map(courses.map((c) => [c.id, c.name]));
}

// Canvas announcements and calendar events use "course_123" context codes.
function parseCourseId(contextCode: string): number | null {
  const match = contextCode.match(/^course_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function buildTools(canvasClient: AnyCanvasClient) {
  return {
    list_assignments: tool({
      description:
        "Fetch the student's Canvas assignments. Use this for any question about upcoming due dates, past assignments, or workload in a course.",
      inputSchema: z.object({
        courseId: z
          .number()
          .optional()
          .describe("Canvas course ID. Omit to fetch from all enrolled courses."),
        dueBefore: z
          .string()
          .optional()
          .describe("ISO 8601 datetime. Return only assignments due before this."),
        dueAfter: z
          .string()
          .optional()
          .describe("ISO 8601 datetime. Return only assignments due after this."),
      }),
      execute: ({ courseId, dueBefore, dueAfter }) =>
        wrapCanvasCall(async () => {
          const [assignments, courseMap] = await Promise.all([
            canvasClient.listAssignments({ courseId, dueBefore, dueAfter }),
            getCourseNameMap(canvasClient),
          ]);
          return assignments.map((a) => ({
            ...a,
            course_name: courseMap.get(a.course_id) ?? `Course ${a.course_id}`,
          }));
        }),
    }),

    get_assignment: tool({
      description:
        "Get full details of a specific assignment including description, rubric, and submission info.",
      inputSchema: z.object({
        courseId: z.number().describe("Canvas course ID."),
        assignmentId: z.number().describe("Canvas assignment ID."),
      }),
      execute: ({ courseId, assignmentId }) =>
        wrapCanvasCall(async () => {
          const [assignment, courseMap] = await Promise.all([
            canvasClient.getAssignment(courseId, assignmentId),
            getCourseNameMap(canvasClient),
          ]);
          return {
            ...assignment,
            course_name: courseMap.get(assignment.course_id) ?? `Course ${assignment.course_id}`,
          };
        }),
    }),

    get_calendar: tool({
      description:
        "Fetch calendar events (class sessions, due dates, exams) within a date range.",
      inputSchema: z.object({
        startDate: z
          .string()
          .describe("ISO 8601 date (YYYY-MM-DD). Start of the range."),
        endDate: z
          .string()
          .describe("ISO 8601 date (YYYY-MM-DD). End of the range."),
      }),
      execute: ({ startDate, endDate }) =>
        wrapCanvasCall(async () => {
          const [events, courseMap] = await Promise.all([
            canvasClient.getCalendar(startDate, endDate),
            getCourseNameMap(canvasClient),
          ]);
          return events.map((e) => {
            const cid = parseCourseId(e.context_code);
            return {
              ...e,
              course_name: cid ? (courseMap.get(cid) ?? `Course ${cid}`) : null,
            };
          });
        }),
    }),

    list_announcements: tool({
      description:
        "Fetch recent announcements from one or all enrolled courses.",
      inputSchema: z.object({
        courseId: z
          .number()
          .optional()
          .describe("Canvas course ID. Omit to fetch from all enrolled courses."),
      }),
      execute: ({ courseId }) =>
        wrapCanvasCall(async () => {
          const [announcements, courseMap] = await Promise.all([
            canvasClient.listAnnouncements(courseId),
            getCourseNameMap(canvasClient),
          ]);
          return announcements.map((a) => {
            const cid = parseCourseId(a.context_code);
            return {
              ...a,
              course_name: cid ? (courseMap.get(cid) ?? `Course ${cid}`) : null,
            };
          });
        }),
    }),

    get_grades: tool({
      description:
        "Fetch the student's current grades (scores and letter grades) for all enrolled courses.",
      inputSchema: z.object({}),
      execute: () =>
        wrapCanvasCall(async () => {
          const [grades, courseMap] = await Promise.all([
            canvasClient.getGrades(),
            getCourseNameMap(canvasClient),
          ]);
          return grades.map((g) => ({
            ...g,
            course_name: courseMap.get(g.course_id) ?? `Course ${g.course_id}`,
          }));
        }),
    }),

    list_modules: tool({
      description:
        "List the modules (units/chapters) in a course to understand its structure.",
      inputSchema: z.object({
        courseId: z.number().describe("Canvas course ID."),
      }),
      execute: ({ courseId }) =>
        wrapCanvasCall(async () => {
          const [modules, courseMap] = await Promise.all([
            canvasClient.listModules(courseId),
            getCourseNameMap(canvasClient),
          ]);
          const courseName = courseMap.get(courseId) ?? `Course ${courseId}`;
          return { course_name: courseName, modules };
        }),
    }),
  };
}
