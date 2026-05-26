import { logger } from "../../shared/logger.js";
import type { TriageCaseEvent } from "../../domain/triage/TriageCaseEvent.js";

export type EventHandler = (event: TriageCaseEvent) => Promise<void> | void;

export interface EventBus {
  subscribe(handler: EventHandler): void;
  publish(events: TriageCaseEvent[]): Promise<void>;
}

export class InProcessEventBus implements EventBus {
  private readonly handlers: EventHandler[] = [];

  subscribe(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async publish(events: TriageCaseEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers) {
        try {
          await handler(event);
        } catch (error) {
          logger.error("event_handler_failed", {
            eventType: event.type,
            caseId: event.caseId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }
}
