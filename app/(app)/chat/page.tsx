"use client";

import { generateId } from "ai";
import { useState } from "react";
import { ChatUI } from "@/components/chat-ui";

export default function NewChatPage() {
  const [chatId] = useState(() => generateId());
  return <ChatUI chatId={chatId} />;
}
