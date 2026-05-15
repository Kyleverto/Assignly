import { NextRequest } from "next/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canvasCredentials,
  threads,
  messages as messagesTable,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { CanvasClient } from "@/lib/canvas/client";
import { CanvasError } from "@/lib/canvas/types";
import { buildTools } from "@/lib/agent/tools";

const MAX_STEPS = parseInt(process.env.MAX_AGENT_ITERATIONS ?? "8");

function buildSystemPrompt(userName: string): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `You are Assignly, an AI academic assistant for university students.
Today is ${today}.
You are helping ${userName}.

Use your Canvas tools whenever you need data to answer the student's question. When listing assignments, organize by due date and include the course name. Be concise and helpful.`;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { message, id: chatId } = (await request.json()) as {
    message: UIMessage;
    id: string;
  };

  if (!chatId || !message) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const cred = await db.query.canvasCredentials.findFirst({
    where: eq(canvasCredentials.userId, session.user.id),
  });
  if (!cred || !session.user.canvasBaseUrl) {
    return Response.json({ error: "no_canvas_connection" }, { status: 403 });
  }

  let token: string;
  try {
    token = decrypt(cred.accessToken);
  } catch {
    return Response.json({ error: "decrypt_failed" }, { status: 500 });
  }

  const canvasClient = new CanvasClient(session.user.canvasBaseUrl, token);
  const tools = buildTools(canvasClient);

  // Find or create thread, then load previous messages
  const existingThread = await db.query.threads.findFirst({
    where: eq(threads.id, chatId),
  });

  let previousMessages: UIMessage[] = [];

  if (existingThread) {
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, chatId))
      .orderBy(asc(messagesTable.createdAt));
    previousMessages = rows.map((r) => r.content as UIMessage);
  } else {
    const text =
      message.parts.find((p) => p.type === "text")?.text ?? "New conversation";
    const title = text.split(/\s+/).slice(0, 6).join(" ");
    await db.insert(threads).values({
      id: chatId,
      userId: session.user.id,
      title,
    });
  }

  // Save the incoming user message before streaming
  await db.insert(messagesTable).values({
    threadId: chatId,
    role: message.role,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: message as any,
  });

  const allMessages = [...previousMessages, message];

  let result;
  try {
    result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: buildSystemPrompt(session.user.name),
      messages: await convertToModelMessages(allMessages, { tools }),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    });
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return Response.json({ error: "canvas_token_expired" }, { status: 401 });
    }
    throw err;
  }

  return result.toUIMessageStreamResponse({
    onFinish: async ({ messages: finalMessages }) => {
      const assistantMsg = finalMessages[finalMessages.length - 1];
      if (assistantMsg?.role === "assistant") {
        await db
          .insert(messagesTable)
          .values({
            threadId: chatId,
            role: "assistant",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: assistantMsg as any,
          })
          .catch(console.error);
      }
    },
  });
}
