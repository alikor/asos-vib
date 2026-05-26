import type { Command, CommandHandler } from "./Command.js";

type Constructor<T> = new (...args: never[]) => T;

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command>>();

  register<TCommand extends Command>(
    commandType: Constructor<TCommand>,
    handler: CommandHandler<TCommand>
  ): void {
    this.handlers.set(commandType.name, handler as CommandHandler<Command>);
  }

  async dispatch<TCommand extends Command>(command: TCommand): Promise<void> {
    const handler = this.handlers.get(command.constructor.name);
    if (!handler) {
      throw new Error(`No handler registered for ${command.constructor.name}`);
    }
    await handler.handle(command);
  }
}
