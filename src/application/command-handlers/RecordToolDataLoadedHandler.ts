import { TriageCase } from "../../domain/triage/TriageCase.js";
import type { EventBus } from "../../infrastructure/persistence/InProcessEventBus.js";
import type { EventStore } from "../../infrastructure/persistence/JsonlEventStore.js";
import type { CommandHandler } from "../commands/Command.js";
import type { RecordToolDataLoadedCommand } from "../commands/RecordToolDataLoadedCommand.js";

export class RecordToolDataLoadedHandler
  implements CommandHandler<RecordToolDataLoadedCommand>
{
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: RecordToolDataLoadedCommand): Promise<void> {
    const stream = await this.eventStore.readStream(command.caseId);
    const aggregate = TriageCase.rehydrate(stream);
    aggregate.recordToolDataLoaded({
      toolName: command.toolName,
      output: command.output,
      occurredAt: command.occurredAt
    });
    const newEvents = aggregate.pullUncommittedEvents();
    await this.eventStore.append(command.caseId, stream.length, newEvents);
    await this.eventBus.publish(newEvents);
  }
}
