import { NextRequest } from "next/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq, asc, and, gte, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canvasCredentials,
  threads,
  messages as messagesTable,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { CanvasClient } from "@/lib/canvas/client";
import { DemoCanvasClient } from "@/lib/canvas/demo-client";
import { CanvasError } from "@/lib/canvas/types";
import { buildTools } from "@/lib/agent/tools";

const MAX_STEPS = parseInt(process.env.MAX_AGENT_ITERATIONS ?? "8");
const RATE_LIMIT_MESSAGES = 20; // max user messages per window
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TOKENS_PER_RESPONSE = 2048;

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

Use your Canvas tools whenever you need data to answer the student's question. When listing assignments, organize by due date and include the course name. Be concise and helpful.

If you reach the end of your allowed steps without a complete answer, tell the student what you found so far and suggest they ask a more focused question.`;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  // DefaultChatTransport sends { id, messages, trigger, messageId, ...extraBody }
  const {
    messages,
    id: chatId,
    messageId,
  } = (await request.json()) as {
    messages: UIMessage[];
    id: string;
    messageId?: string;
    trigger?: string;
  };

  if (!chatId || !messages?.length) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  // Rate limit: max 20 user messages per 10 minutes per user (DB-backed, works on serverless)
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [{ value: recentCount }] = await db
    .select({ value: count() })
    .from(messagesTable)
    .innerJoin(threads, eq(messagesTable.threadId, threads.id))
    .where(
      and(
        eq(threads.userId, session.user.id),
        eq(messagesTable.role, "user"),
        gte(messagesTable.createdAt, windowStart)
      )
    );

  if (recentCount >= RATE_LIMIT_MESSAGES) {
    return Response.json(
      { error: "You've sent too many messages. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  const cred = await db.query.canvasCredentials.findFirst({
    where: eq(canvasCredentials.userId, session.user.id),
  });
  if (!cred || !session.user.canvasBaseUrl) {
    return Response.json({ error: "no_canvas_connection" }, { status: 403 });
  }

  const isDemo = session.user.canvasBaseUrl === "demo";
  let canvasClient: CanvasClient | DemoCanvasClient;

  if (isDemo) {
    canvasClient = new DemoCanvasClient();
  } else {
    let token: string;
    try {
      token = decrypt(cred.accessToken);
    } catch {
      return Response.json({ error: "decrypt_failed" }, { status: 500 });
    }
    canvasClient = new CanvasClient(session.user.canvasBaseUrl, token, session.user.id);
  }

  const tools = buildTools(canvasClient);

  // Create thread on first message
  const existingThread = await db.query.threads.findFirst({
    where: eq(threads.id, chatId),
  });

  if (!existingThread) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    const text =
      firstUserMsg?.parts.find((p) => p.type === "text")?.text ??
      "New conversation";
    const title = text.split(/\s+/).slice(0, 6).join(" ");
    await db.insert(threads).values({
      id: chatId,
      userId: session.user.id,
      title,
    });
  }

  // Save the new user message (identified by messageId, or fall back to last user message)
  const newUserMsg = messageId
    ? messages.find((m) => m.id === messageId)
    : messages.filter((m) => m.role === "user").at(-1);

  if (newUserMsg) {
    // Check if already saved (avoid duplicates on retry)
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, chatId))
      .orderBy(asc(messagesTable.createdAt));

    const savedIds = new Set(
      rows.map((r) => (r.content as UIMessage).id)
    );

    if (!savedIds.has(newUserMsg.id)) {
      await db.insert(messagesTable).values({
        threadId: chatId,
        role: newUserMsg.role,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: newUserMsg as any,
      });
    }
  }

  // IDs already in the request — used to identify the new assistant message in onFinish
  const sentIds = new Set(messages.map((m) => m.id));

  let result;
  try {
    result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: buildSystemPrompt(session.user.name),
      messages: await convertToModelMessages(messages, { tools }),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: MAX_TOKENS_PER_RESPONSE,
    });
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return Response.json({ error: "canvas_token_expired" }, { status: 401 });
    }
    throw err;
  }

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      // Save only messages that weren't in the original request (the new assistant response)
      for (const msg of finalMessages) {
        if (!sentIds.has(msg.id) && msg.role === "assistant") {
          await db
            .insert(messagesTable)
            .values({
              threadId: chatId,
              role: "assistant",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: msg as any,
            })
            .catch(console.error);
        }
      }
    },
  });
}
