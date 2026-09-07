/**
 * 4ang Events API
 */

import { request } from "./client";
import type { AppEvent } from "@4ang/shared-types";

export interface EventBatchRequest {
  events: Omit<AppEvent, "id" | "user_id">[];
}

export const eventsApi = {
  /** Record a batch of events */
  batch: (events: Omit<AppEvent, "id" | "user_id">[]) =>
    request<{ recorded: number }>("/events/batch", {
      method: "POST",
      body: { events },
    }),

  /** Record a single event */
  record: (eventType: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) =>
    request<{ recorded: boolean }>("/events", {
      method: "POST",
      body: { event_type: eventType, entity_type: entityType, entity_id: entityId, metadata },
    }),

  /** Get event history */
  history: (limit?: number) =>
    request<{ events: AppEvent[] }>(`/events/history${limit ? `?limit=${limit}` : ""}`),

  /** Get event statistics */
  stats: (since?: string) =>
    request<{ stats: Record<string, number> }>(
      `/events/stats${since ? `?since=${since}` : ""}`
    ),
};
