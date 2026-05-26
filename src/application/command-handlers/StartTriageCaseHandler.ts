import { TriageCase } from "../../domain/triage/TriageCase.js";
import type { EventBus } from "../../infrastructure/persistence/InProcessEventBus.js";
import type { EventStore } from "../../infrastructure/persistence/JsonlEventStore.js";
import type { CommandHandler } from "../commands/Command.js";
import type { StartTriageCaseCommand } from "../commands/StartTriageCaseCommand.js";

export class StartTriageCaseHandler implements CommandHandler<StartTriageCaseCommand> {
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: StartTriageCaseCommand): Promise<void> {
    const aggregate = TriageCase.start({
      caseId: command.caseId,
      question: command.question,
      poId: command.poId,
      occurredAt: command.occurredAt
    });
    const events = aggregate.pullUncommittedEvents();
    await this.eventStore.append(command.caseId, 0, events);
    await this.eventBus.publish(events);
  }
}
