export interface Command {
  readonly commandId: string;
  readonly occurredAt: string;
}

export interface CommandHandler<TCommand extends Command> {
  handle(command: TCommand): Promise<void>;
}
