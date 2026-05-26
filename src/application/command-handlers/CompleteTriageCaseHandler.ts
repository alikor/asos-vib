import { TriageCase } from "../../domain/triage/TriageCase.js";
import type { EventBus } from "../../infrastructure/persistence/InProcessEventBus.js";
import type { EventStore } from "../../infrastructure/persistence/JsonlEventStore.js";
import type { CommandHandler } from "../commands/Command.js";
import type { CompleteTriageCaseCommand } from "../commands/CompleteTriageCaseCommand.js";

export class CompleteTriageCaseHandler implements CommandHandler<CompleteTriageCaseCommand> {
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: CompleteTriageCaseCommand): Promise<void> {
    const stream = await this.eventStore.readStream(command.caseId);
    const aggregate = TriageCase.rehydrate(stream);
    aggregate.complete({
      finalRecommendation: command.finalRecommendation,
      occurredAt: command.occurredAt
    });
    const newEvents = aggregate.pullUncommittedEvents();
    await this.eventStore.append(command.caseId, stream.length, newEvents);
    await this.eventBus.publish(newEvents);
  }
}
