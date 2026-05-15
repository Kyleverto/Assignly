import { tool } from "ai";
import { z } from "zod";
import type { CanvasClient } from "@/lib/canvas/client";

export function buildTools(canvasClient: CanvasClient) {
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
  };
}
