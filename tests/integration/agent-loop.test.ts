/**
 * Integration test: agent loop end-to-end
 *
 * What this proves:
 * - POST /api/chat orchestrates the full agent loop
 * - The Anthropic API is called (mocked via msw at the HTTP level)
 * - The model can make a tool call; the tool executes against DemoCanvasClient
 * - The final assistant message is persisted to the DB
 * - A thread row is created on first message
 *
 * Requires: DATABASE_URL (skipped when absent, e.g. unit-only CI)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { eq } from "drizzle-orm";

// Mock auth before any other imports so the chat route sees the mock
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const dbUrl = process.env.DATABASE_URL;

describe.skipIf(!dbUrl)("Agent loop integration", () => {
  const TEST_USER_ID = "integration-test-user-001";
  const TEST_CHAT_ID = "integration-test-chat-001";

  // MSW server intercepts all outbound HTTP from the test process
  const server = setupServer();

  beforeAll(async () => {
    // Fake encryption key needed by the chat route's crypto module
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    // Fake Anthropic key (real key not needed — calls are intercepted by msw)
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake-key-for-integration";

    server.listen({ onUnhandledRequest: "warn" });

    // Insert the test user and a demo canvas credential directly into DB
    const { db } = await import("@/lib/db");
    const { user, canvasCredentials } = await import("@/lib/db/schema");
    const { encrypt } = await import("@/lib/crypto");

    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Integration Test Student",
        email: "integration-test@assignly.test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        canvasBaseUrl: "demo", // demo mode — DemoCanvasClient, no real Canvas calls
      })
      .onConflictDoNothing();

    await db
      .insert(canvasCredentials)
      .values({
        userId: TEST_USER_ID,
        accessToken: encrypt("demo"), // value doesn't matter in demo mode
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    server.resetHandlers();
    vi.resetAllMocks();

    // Delete any threads + messages created during the test
    const { db } = await import("@/lib/db");
    const { threads, messages } = await import("@/lib/db/schema");
    const rows = await db.query.threads.findMany({
      where: eq(threads.userId, TEST_USER_ID),
    });
    for (const t of rows) {
      await db.delete(messages).where(eq(messages.threadId, t.id));
    }
    await db.delete(threads).where(eq(threads.userId, TEST_USER_ID));
  });

  afterAll(async () => {
    server.close();

    const { db } = await import("@/lib/db");
    const { user, canvasCredentials, canvasCache } = await import("@/lib/db/schema");

    await db.delete(canvasCache).where(eq(canvasCache.userId, TEST_USER_ID));
    await db.delete(canvasCredentials).where(eq(canvasCredentials.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  it("persists a thread and messages, runs the tool call loop, and returns a streamed response", async () => {
    // Configure the auth mock to return our test user's session
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        name: "Integration Test Student",
        email: "integration-test@assignly.test",
        canvasBaseUrl: "demo",
        canvasUserId: null,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "test-session-001",
        userId: TEST_USER_ID,
        token: "test-token",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
    } as never);

    // Mock Anthropic: two consecutive calls to /v1/messages
    // Call 1: model decides to call the list_assignments tool
    // Call 2: model receives tool result and returns a final text answer
    let anthropicCallCount = 0;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        anthropicCallCount++;

        if (anthropicCallCount === 1) {
          // First response: a tool_use block requesting list_assignments
          return new HttpResponse(
            makeAnthropicSSE([
              { event: "message_start", data: { type: "message_start", message: { id: "msg_01", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-6", stop_reason: null, stop_sequence: null, usage: { input_tokens: 200, output_tokens: 0 } } } },
              { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_01", name: "list_assignments", input: {} } } },
              { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } } },
              { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
              { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 25 } } },
              { event: "message_stop", data: { type: "message_stop" } },
            ]),
            { headers: { "content-type": "text/event-stream" } }
          );
        }

        // Second response: final text answer after receiving tool result
        return new HttpResponse(
          makeAnthropicSSE([
            { event: "message_start", data: { type: "message_start", message: { id: "msg_02", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-6", stop_reason: null, stop_sequence: null, usage: { input_tokens: 350, output_tokens: 0 } } } },
            { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
            { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "You have 8 upcoming assignments across your courses." } } },
            { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
            { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 15 } } },
            { event: "message_stop", data: { type: "message_stop" } },
          ]),
          { headers: { "content-type": "text/event-stream" } }
        );
      })
    );

    // Import and call the route handler directly
    const { POST } = await import("@/app/api/chat/route");

    const userMessage = {
      id: "user-msg-001",
      role: "user" as const,
      content: "What assignments do I have coming up?",
      parts: [{ type: "text" as const, text: "What assignments do I have coming up?" }],
      createdAt: new Date(),
    };

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        id: TEST_CHAT_ID,
        messages: [userMessage],
        messageId: userMessage.id,
      }),
      headers: { "content-type": "application/json" },
    });

    // Call the route — consumes the full stream (triggers onFinish which saves messages)
    const response = await POST(request as never);
    expect(response.status).toBe(200);

    // Drain the stream so onFinish fires
    await response.text();

    // Give onFinish's async DB writes a moment to complete
    await new Promise((r) => setTimeout(r, 200));

    // Verify DB state
    const { db } = await import("@/lib/db");
    const { threads, messages } = await import("@/lib/db/schema");

    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, TEST_CHAT_ID),
    });
    expect(thread).toBeDefined();
    expect(thread?.userId).toBe(TEST_USER_ID);

    const savedMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, TEST_CHAT_ID),
    });

    // Should have at least the user message + the assistant response
    expect(savedMessages.length).toBeGreaterThanOrEqual(2);

    const roles = savedMessages.map((m) => m.role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");

    // The Anthropic API was called twice (tool call + final response)
    expect(anthropicCallCount).toBe(2);
  });
});

// Encodes a list of { event, data } pairs as an Anthropic-style SSE stream
function makeAnthropicSSE(
  events: { event: string; data: object }[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const { event, data } of events) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }
      controller.close();
    },
  });
}
