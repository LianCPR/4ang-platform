/**
 * 4ang Assistant API
 */

import { request } from "./client";
import type { AssistantResponse, AssistantConversation, AssistantMessage } from "@4ang/shared-types";

export const assistantApi = {
  /** Send a message to the assistant */
  message: (message: string, conversationId?: string, context?: Record<string, unknown>) =>
    request<AssistantResponse>("/assistant/message", {
      method: "POST",
      body: { message, conversationId, context },
    }),

  /** List conversations */
  conversations: (limit?: number) =>
    request<{ conversations: AssistantConversation[] }>(
      `/assistant/conversations${limit ? `?limit=${limit}` : ""}`
    ),

  /** Get conversation messages */
  conversationMessages: (id: string) =>
    request<{ messages: AssistantMessage[] }>(`/assistant/conversations/${id}/messages`),

  /** Delete a conversation */
  deleteConversation: (id: string) =>
    request<{ deleted: boolean }>(`/assistant/conversations/${id}`, { method: "DELETE" }),

  /** Get assistant status */
  status: () =>
    request<{ tools: string[]; intentTypes: string[]; version: string }>("/assistant/status"),
};
