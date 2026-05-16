import { tool } from "ai";
import { z } from "zod";
import type { CanvasClient } from "@/lib/canvas/client";
import type { DemoCanvasClient } from "@/lib/canvas/demo-client";

type AnyCanvasClient = CanvasClient | DemoCanvasClient;

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
      execute: async ({ courseId, dueBefore, dueAfter }) => {
        return canvasClient.listAssignments({ courseId, dueBefore, dueAfter });
      },
    }),

    get_assignment: tool({
      description:
        "Get full details of a specific assignment including description, rubric, and submission info.",
      inputSchema: z.object({
        courseId: z.number().describe("Canvas course ID."),
        assignmentId: z.number().describe("Canvas assignment ID."),
      }),
      execute: async ({ courseId, assignmentId }) => {
        return canvasClient.getAssignment(courseId, assignmentId);
      },
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
      execute: async ({ startDate, endDate }) => {
        return canvasClient.getCalendar(startDate, endDate);
      },
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
      execute: async ({ courseId }) => {
        return canvasClient.listAnnouncements(courseId);
      },
    }),

    get_grades: tool({
      description:
        "Fetch the student's current grades (scores and letter grades) for all enrolled courses.",
      inputSchema: z.object({}),
      execute: async () => {
        return canvasClient.getGrades();
      },
    }),

    list_modules: tool({
      description:
        "List the modules (units/chapters) in a course to understand its structure.",
      inputSchema: z.object({
        courseId: z.number().describe("Canvas course ID."),
      }),
      execute: async ({ courseId }) => {
        return canvasClient.listModules(courseId);
      },
    }),
  };
}
