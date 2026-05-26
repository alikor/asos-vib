import { TriageCase } from "../../domain/triage/TriageCase.js";
import type { EventBus } from "../../infrastructure/persistence/InProcessEventBus.js";
import type { EventStore } from "../../infrastructure/persistence/JsonlEventStore.js";
import type { CommandHandler } from "../commands/Command.js";
import type { RecordGuardrailsEvaluatedCommand } from "../commands/RecordGuardrailsEvaluatedCommand.js";

export class RecordGuardrailsEvaluatedHandler
  implements CommandHandler<RecordGuardrailsEvaluatedCommand>
{
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: RecordGuardrailsEvaluatedCommand): Promise<void> {
    const stream = await this.eventStore.readStream(command.caseId);
    const aggregate = TriageCase.rehydrate(stream);
    aggregate.recordGuardrailsEvaluated({
      results: command.results,
      occurredAt: command.occurredAt
    });
    const newEvents = aggregate.pullUncommittedEvents();
    await this.eventStore.append(command.caseId, stream.length, newEvents);
    await this.eventBus.publish(newEvents);
  }
}
